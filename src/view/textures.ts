/**
 * Textures de planetes, entierement generees par code.
 *
 * Aucun fichier image n'est charge : chaque monde peint sa propre surface a
 * partir de sa palette et d'un trait dominant declares dans planet-types.json.
 * C'est la seule approche viable a l'echelle de deux mille planetes, et c'est
 * elle qui permettra plus tard d'interpoler l'apparence de deux especes
 * croisees plutot que de sculpter un modele par combinaison.
 *
 * Chaque texture est deterministe : elle derive du germe de la galaxie et de
 * l'identifiant du monde. Une planete a donc toujours le meme visage.
 */

import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { TypePlanete } from '../core/data';
import type { Planete } from '../core/types';

type RVB = [number, number, number];

function toile(l: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  return c;
}

function versRvb(hex: string): RVB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function melange(a: RVB, b: RVB, t: number): RVB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Rampe a quatre teintes : la palette du type, etalee sur [0,1]. */
function rampe(palette: RVB[], n: number): RVB {
  const t = Math.max(0, Math.min(0.9999, n)) * (palette.length - 1);
  const i = Math.floor(t);
  return melange(palette[i], palette[i + 1], t - i);
}

/**
 * Champ de bruit : des taches additionnees puis floutees, enroulees en X pour
 * que la texture se referme sans couture sur la sphere.
 */
function champ(l: number, h: number, taches: number, rayon: number, rng: Rng): Float32Array {
  const f = new Float32Array(l * h);
  for (let b = 0; b < taches; b++) {
    const cx = rng.next() * l;
    const cy = rng.next() * h;
    const r = rayon * (0.35 + rng.next());
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = (x - cx) / r;
        const dy = (y - cy) / r;
        const d = dx * dx + dy * dy;
        if (d < 1) f[y * l + (((x % l) + l) % l)] += (1 - d) * (1 - d);
      }
    }
  }
  flou(f, l, h, 2, 2);
  let max = 0;
  for (const v of f) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < f.length; i++) f[i] /= max;
  return f;
}

function flou(f: Float32Array, l: number, h: number, r: number, passes: number): void {
  const tmp = new Float32Array(f.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < l; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += f[y * l + ((((x + k) % l) + l) % l)];
        tmp[y * l + x] = s / (2 * r + 1);
      }
    for (let x = 0; x < l; x++)
      for (let y = 0; y < h; y++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * l + x];
        f[y * l + x] = s / (2 * r + 1);
      }
  }
}

function lire(f: Float32Array, l: number, h: number, u: number, v: number): number {
  const x = u * l - 0.5;
  const y = v * h - 0.5;
  let x0 = Math.floor(x);
  const y0c = Math.min(h - 1, Math.max(0, Math.floor(y)));
  const tx = x - x0;
  const ty = y - Math.floor(y);
  const x1 = (((x0 + 1) % l) + l) % l;
  x0 = ((x0 % l) + l) % l;
  const y1 = Math.min(h - 1, y0c + 1);
  const a = f[y0c * l + x0];
  const b = f[y0c * l + x1];
  const c = f[y1 * l + x0];
  const d = f[y1 * l + x1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function enTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Peint une sphere 2:1 a partir d'un champ et d'une fonction de couleur. */
function peindre(
  l: number,
  h: number,
  f: Float32Array,
  fl: number,
  fh: number,
  couleur: (n: number, lat: number, u: number, v: number) => RVB,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = toile(l, h);
  const g = c.getContext('2d')!;
  const img = g.createImageData(l, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / h;
    const lat = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < l; x++) {
      const col = couleur(lire(f, fl, fh, x / l, v), lat, x / l, v);
      const p = (y * l + x) * 4;
      d[p] = col[0];
      d[p + 1] = col[1];
      d[p + 2] = col[2];
      d[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, ctx: g };
}

/* ------------------------------------------------------------ traits */

/** Cratères : le relief des mondes sans atmosphere pour les effacer. */
function crateres(g: CanvasRenderingContext2D, l: number, h: number, rng: Rng): void {
  // Beaucoup de petits impacts, quelques grands : c'est la distribution reelle,
  // et c'est aussi ce qui evite l'effet « bulles de savon » d'un liseré trop net.
  for (let i = 0; i < 260; i++) {
    const x = rng.next() * l;
    const y = rng.next() * h;
    const r = 2 + rng.skewed(1, 20, 3);
    const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,0.34)');
    gr.addColorStop(0.74, 'rgba(0,0,0,0.13)');
    gr.addColorStop(0.93, 'rgba(255,255,255,0.09)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

/** Un grand canyon transversal : la signature des mondes erodes. */
function canyon(g: CanvasRenderingContext2D, l: number, h: number, rng: Rng): void {
  g.lineCap = 'round';
  for (let passe = 0; passe < 2; passe++) {
    g.beginPath();
    let y = h * (0.35 + rng.next() * 0.3);
    g.moveTo(l * 0.05, y);
    for (let x = l * 0.05; x < l * 0.96; x += l / 24) {
      y += (rng.next() - 0.5) * h * 0.055;
      g.lineTo(x, y);
    }
    g.strokeStyle = passe === 0 ? 'rgba(40,20,14,0.5)' : 'rgba(18,8,6,0.7)';
    g.lineWidth = passe === 0 ? h * 0.045 : h * 0.018;
    g.stroke();
  }
}

/** Fractures incandescentes, peintes sur un calque d'emission separe. */
function fractures(l: number, h: number, rng: Rng): HTMLCanvasElement {
  const e = toile(l, h);
  const g = e.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, l, h);
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (let k = 0; k < 120; k++) {
    const depart = { x: rng.next() * l, y: rng.next() * h };
    let angle = rng.next() * Math.PI * 2;
    const segments = 8 + rng.next() * 20;
    for (let passe = 0; passe < 2; passe++) {
      g.beginPath();
      g.moveTo(depart.x, depart.y);
      let x = depart.x;
      let y = depart.y;
      let a = angle;
      for (let s = 0; s < segments; s++) {
        a += (rng.next() - 0.5) * 0.9;
        x += Math.cos(a) * (l / 115);
        y += Math.sin(a) * (l / 115);
        g.lineTo(x, y);
      }
      g.strokeStyle = passe === 0 ? 'rgba(190,52,10,0.3)' : 'rgba(255,178,80,0.85)';
      g.lineWidth = passe === 0 ? l / 95 : l / 460;
      g.stroke();
      angle = a;
    }
  }
  return e;
}

/** Veines claires dans une croute sombre. */
function veines(g: CanvasRenderingContext2D, l: number, h: number, rng: Rng): void {
  g.lineCap = 'round';
  for (let k = 0; k < 80; k++) {
    let x = rng.next() * l;
    let y = rng.next() * h;
    let a = rng.next() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 22; s++) {
      a += (rng.next() - 0.5) * 0.45;
      x += Math.cos(a) * (l / 70);
      y += Math.sin(a) * (l / 70);
      g.lineTo(x, y);
    }
    g.strokeStyle = `rgba(200,196,210,${0.08 + rng.next() * 0.14})`;
    g.lineWidth = 0.6 + rng.next() * 2.2;
    g.stroke();
  }
}

/** Fractures de banquise : lignes claires et depots organiques. */
function banquise(g: CanvasRenderingContext2D, l: number, h: number, rng: Rng): void {
  g.lineCap = 'round';
  for (let k = 0; k < 85; k++) {
    let x = rng.next() * l;
    let y = rng.next() * h;
    let a = rng.next() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 26; s++) {
      a += (rng.next() - 0.5) * 0.28;
      x += Math.cos(a) * (l / 64);
      y += Math.sin(a) * (l / 64);
      g.lineTo(x, y);
    }
    g.strokeStyle = rng.next() > 0.4 ? 'rgba(74,120,150,0.4)' : 'rgba(146,102,72,0.32)';
    g.lineWidth = 0.8 + rng.next() * 3;
    g.stroke();
  }
}

/* --------------------------------------------------------- generateurs */

function surfaceGeante(type: TypePlanete, rng: Rng, tempete: boolean): THREE.CanvasTexture {
  const L = 1024;
  const H = 512;
  const c = toile(L, H);
  const g = c.getContext('2d')!;
  const palette = type.rendu.palette.map(versRvb);

  // Bandes zonales : une pile de gradients horizontaux, comme sur une geante reelle.
  const grad = g.createLinearGradient(0, 0, 0, H);
  const bandes = 12 + Math.floor(rng.next() * 6);
  for (let i = 0; i <= bandes; i++) {
    const t = i / bandes;
    const col = rampe(palette, Math.abs(Math.sin(t * Math.PI * 3.1 + rng.next() * 0.3)));
    grad.addColorStop(t, `rgb(${col.map(Math.round).join(',')})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, L, H);

  for (let y = 0; y < H; y++) {
    const n =
      Math.sin(y * 0.31) * 0.5 + Math.sin(y * 0.09 + 1.4) * 0.35 +
      Math.sin(y * 0.83 + 3.1) * 0.15 + (rng.next() - 0.5) * 0.45;
    g.fillStyle = (n > 0 ? 'rgba(240,248,236,' : 'rgba(16,26,32,') + Math.min(Math.abs(n) * 0.1, 0.11) + ')';
    g.fillRect(0, y, L, 1);
  }
  if ('filter' in g) g.filter = 'blur(4px)';
  for (let k = 0; k < 260; k++) {
    const y = rng.next() * H;
    const lat = Math.abs(y - H / 2) / (H / 2);
    g.fillStyle = rng.next() > 0.5 ? 'rgba(240,250,238,0.14)' : 'rgba(14,26,32,0.14)';
    g.beginPath();
    g.ellipse(rng.next() * L, y, 25 + rng.next() * 190 * (1 - lat * 0.6), 2 + rng.next() * 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (tempete) {
    const x = rng.next() * L;
    const y = H * (0.35 + rng.next() * 0.3);
    g.fillStyle = 'rgba(196,120,92,0.5)';
    g.beginPath();
    g.ellipse(x, y, 60, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(238,196,160,0.45)';
    g.beginPath();
    g.ellipse(x, y, 31, 11, 0, 0, Math.PI * 2);
    g.fill();
  }
  if ('filter' in g) g.filter = 'none';
  return enTexture(c);
}

function surfaceTellurique(type: TypePlanete, rng: Rng, taille: number): {
  map: THREE.CanvasTexture;
  emissive?: THREE.CanvasTexture;
} {
  const L = taille;
  const H = taille / 2;
  const palette = type.rendu.palette.map(versRvb);
  const trait = type.rendu.trait;
  const fl = 224;
  const fh = 112;
  const f = champ(fl, fh, 100, 16, rng);

  const glace: RVB = [226, 238, 244];
  const sortie = peindre(L, H, f, fl, fh, (n, lat) => {
    let c: RVB;
    if (trait === 'continents') {
      // Ocean, littoral, plaines, reliefs : la lecture classique d'un monde vivant.
      if (n < 0.42) c = melange(palette[0], palette[1], n / 0.42);
      else if (n < 0.47) c = melange(palette[1], palette[3], (n - 0.42) / 0.05);
      else if (n < 0.74) c = melange(palette[2], palette[1], (n - 0.47) / 0.27);
      else c = melange(palette[2], palette[3], (n - 0.74) / 0.26);
      if (lat > 0.8) c = melange(c, glace, Math.min(1, (lat - 0.8) / 0.17));
    } else if (trait === 'oceans') {
      if (n < 0.62) c = melange(palette[0], palette[1], n / 0.62);
      else if (n < 0.84) c = melange(palette[1], palette[2], (n - 0.62) / 0.22);
      else c = melange(palette[2], palette[3], (n - 0.84) / 0.16);
      if (lat > 0.86) c = melange(c, glace, (lat - 0.86) / 0.14);
    } else if (trait === 'banquise') {
      c = rampe(palette, 0.35 + n * 0.65);
      if (n > 0.7) c = melange(c, [176, 138, 98], ((n - 0.7) / 0.3) * 0.6);
    } else {
      c = rampe(palette, n);
      if (lat > 0.9 && trait === 'canyon') c = melange(c, [214, 208, 202], (lat - 0.9) / 0.1);
    }
    return c;
  });

  const g = sortie.ctx;
  if (trait === 'crateres') crateres(g, L, H, rng);
  if (trait === 'canyon') canyon(g, L, H, rng);
  if (trait === 'veines') veines(g, L, H, rng);
  if (trait === 'banquise') banquise(g, L, H, rng);

  const resultat: { map: THREE.CanvasTexture; emissive?: THREE.CanvasTexture } = {
    map: enTexture(sortie.canvas),
  };
  if (trait === 'fractures') {
    const e = fractures(L, H, rng);
    // Les fractures marquent aussi la couleur de base, pas seulement l'emission.
    g.globalCompositeOperation = 'lighter';
    g.drawImage(e, 0, 0);
    g.globalCompositeOperation = 'source-over';
    resultat.map = enTexture(sortie.canvas);
    resultat.emissive = enTexture(e);
  }
  return resultat;
}

/** Couche nuageuse, sur son propre canevas a alpha variable. */
function nuages(rng: Rng, densite: number): THREE.CanvasTexture {
  const L = 512;
  const H = 256;
  const f = champ(224, 112, 120, 13, rng);
  const c = toile(L, H);
  const g = c.getContext('2d')!;
  const img = g.createImageData(L, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const lat = Math.abs(y / H - 0.5) * 2;
    for (let x = 0; x < L; x++) {
      const n = lire(f, 224, 112, x / L, y / H);
      let a = Math.max(0, (n - 0.5) / 0.5);
      a *= 0.55 + 0.45 * Math.sin(lat * Math.PI * 3) * 0.5 + 0.3;
      const p = (y * L + x) * 4;
      d[p] = 255;
      d[p + 1] = 255;
      d[p + 2] = 252;
      d[p + 3] = Math.min(235, a * 300 * densite);
    }
  }
  g.putImageData(img, 0, 0);
  return enTexture(c);
}

/** Anneaux : une bande radiale d'opacite, avec ses divisions. */
export function textureAnneaux(rng: Rng): THREE.CanvasTexture {
  const L = 512;
  const c = toile(L, 1);
  const g = c.getContext('2d')!;
  const img = g.createImageData(L, 1);
  const d = img.data;
  for (let x = 0; x < L; x++) {
    const u = x / L;
    let a = u < 0.2 ? 0.28 + u * 1.1 : u < 0.58 ? 0.9 : u < 0.84 ? 0.66 : 0.3;
    if (u < 0.05 || (u > 0.58 && u < 0.63) || (u > 0.86 && u < 0.875) || u > 0.97) a *= 0.07;
    const s = Math.sin(u * 230) * 0.5 + Math.sin(u * 88 + 1.9) * 0.35 + Math.sin(u * 520 + 0.4) * 0.25;
    a = Math.max(0, Math.min(1, a * (0.8 + s * 0.2 + (rng.next() - 0.5) * 0.08)));
    const b = 0.84 + s * 0.16;
    const p = x * 4;
    d[p] = 206 * b;
    d[p + 1] = 216 * b;
    d[p + 2] = 222 * b;
    d[p + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = enTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export interface TexturesMonde {
  map: THREE.Texture;
  emissive?: THREE.Texture;
  nuages?: THREE.Texture;
}

/**
 * Textures completes d'un monde. Le germe de la galaxie et l'identite de la
 * planete suffisent a les reproduire : rien n'est stocke, rien n'est telecharge.
 */
export function texturesMonde(
  planete: Planete,
  type: TypePlanete,
  germe: string,
  idSysteme: number,
): TexturesMonde {
  const rng = new Rng(`${germe}:${idSysteme}:${planete.id}:surface`);

  if (type.categorie === 'geante') {
    return { map: surfaceGeante(type, rng, type.id === 'geante_gazeuse' && rng.chance(0.6)) };
  }

  const taille = planete.rayonKm > 8000 ? 1024 : 512;
  const base = surfaceTellurique(type, rng, taille);
  const resultat: TexturesMonde = { map: base.map };
  if (base.emissive) resultat.emissive = base.emissive;

  // Des nuages seulement la ou une atmosphere epaisse a un sens.
  const densite =
    type.rendu.trait === 'continents' || type.rendu.trait === 'oceans' ? 1 :
    type.rendu.trait === 'voile' ? 1.6 : 0;
  if (densite > 0) resultat.nuages = nuages(rng, densite);
  return resultat;
}

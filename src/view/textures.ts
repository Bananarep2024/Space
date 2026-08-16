/**
 * Textures de planetes, entierement generees par code.
 *
 * Aucun fichier image n'est charge : chaque monde peint sa propre surface a
 * partir de sa palette et d'un trait dominant declares dans planet-types.json.
 * C'est la seule approche viable a l'echelle de deux mille planetes, et c'est
 * elle qui permettra plus tard d'interpoler l'apparence de deux especes
 * croisees plutot que de sculpter un modele par combinaison.
 *
 * Trois mecanismes evitent que deux mondes du meme type se ressemblent :
 * un relief multi-octaves plutot qu'un seul bruit flou, une palette decalee
 * par monde selon sa temperature, et un niveau des mers propre a chacun.
 * Chaque texture reste deterministe — elle derive du germe de la galaxie et
 * de l'identifiant du monde, donc une planete a toujours le meme visage.
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

function rampe(palette: RVB[], n: number): RVB {
  const t = Math.max(0, Math.min(0.9999, n)) * (palette.length - 1);
  const i = Math.floor(t);
  return melange(palette[i], palette[i + 1], t - i);
}

/* ------------------------------------------------------- variation de teinte */

function versTsl(c: RVB): [number, number, number] {
  const r = c[0] / 255, v = c[1] / 255, b = c[2] / 255;
  const max = Math.max(r, v, b), min = Math.min(r, v, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let t: number;
  if (max === r) t = ((v - b) / d + (v < b ? 6 : 0)) / 6;
  else if (max === v) t = ((b - r) / d + 2) / 6;
  else t = ((r - v) / d + 4) / 6;
  return [t, s, l];
}

function versRvbDepuisTsl(t: number, s: number, l: number): RVB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (d: number) => {
    if (d < 0) d += 1;
    if (d > 1) d -= 1;
    if (d < 1 / 6) return p + (q - p) * 6 * d;
    if (d < 1 / 2) return q;
    if (d < 2 / 3) return p + (q - p) * (2 / 3 - d) * 6;
    return p;
  };
  return [canal(t + 1 / 3) * 255, canal(t) * 255, canal(t - 1 / 3) * 255];
}

/**
 * Decale la palette d'un type pour ce monde precis : un peu de teinte, un peu
 * de clarte, et un biais chaud ou froid tire de sa temperature de surface.
 * Deux deserts du meme systeme ne sont plus jumeaux.
 */
function paletteDuMonde(type: TypePlanete, planete: Planete, rng: Rng): RVB[] {
  const decalTeinte = rng.range(-0.06, 0.06);
  // Une palette deja saturee ne supporte qu'un leger decalage ; une palette
  // grise, elle, peut virer franchement au brun, au bleute ou au verdatre.
  const satMoyenne = type.rendu.palette.reduce((a, hex) => a + versTsl(versRvb(hex))[1], 0) / type.rendu.palette.length;
  const decalSat = satMoyenne < 0.14 ? rng.range(-0.04, 0.26) : rng.range(-0.16, 0.16);
  const decalClarte = rng.range(-0.09, 0.09);
  // Un monde brulant tire vers l'ocre, un monde glacial vers le bleu.
  const chaleur = Math.max(-1, Math.min(1, planete.temperatureC / 320));
  return type.rendu.palette.map((hex) => {
    const [t, s, l] = versTsl(versRvb(hex));
    const teinte = (t + decalTeinte - chaleur * 0.018 + 1) % 1;
    return versRvbDepuisTsl(
      teinte,
      Math.max(0, Math.min(1, s + decalSat)),
      Math.max(0.02, Math.min(0.97, l + decalClarte)),
    );
  });
}

/* --------------------------------------------------------------- relief */

interface Octave {
  f: Float32Array;
  l: number;
  h: number;
  poids: number;
}

/** Taches additionnees puis floutees, enroulees en X pour fermer la sphere. */
function champ(l: number, h: number, taches: number, rayon: number, rng: Rng, flouR: number): Float32Array {
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
  if (flouR > 0) flou(f, l, h, flouR, 1);
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
  return (
    (f[y0c * l + x0] * (1 - tx) + f[y0c * l + x1] * tx) * (1 - ty) +
    (f[y1 * l + x0] * (1 - tx) + f[y1 * l + x1] * tx) * ty
  );
}

/**
 * Relief multi-octaves. Une seule frequence donne des taches molles ; trois
 * frequences superposees donnent des cotes decoupees, des massifs et du grain.
 */
function relief(L: number, H: number, rng: Rng, echelle: number): Float32Array {
  const grossieres: Octave[] = [
    { f: champ(128, 64, Math.round(26 * echelle), 15, rng, 2), l: 128, h: 64, poids: 1 },
    { f: champ(256, 128, Math.round(120 * echelle), 9, rng, 1), l: 256, h: 128, poids: 0.5 },
  ];
  // Les deux dernieres octaves sont du grain : un echantillonnage au plus proche
  // suffit, et il coute trois fois moins que la bilineaire sur une grande image.
  const fines: Octave[] = [
    { f: champ(512, 256, Math.round(520 * echelle), 5, rng, 1), l: 512, h: 256, poids: 0.26 },
    { f: champ(512, 256, 1400, 2.4, rng, 0), l: 512, h: 256, poids: 0.13 },
  ];
  const total = [...grossieres, ...fines].reduce((s, o) => s + o.poids, 0);
  const out = new Float32Array(L * H);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < L; x++) {
      const u = (x + 0.5) / L;
      let s = 0;
      for (const o of grossieres) s += lire(o.f, o.l, o.h, u, v) * o.poids;
      for (const o of fines) {
        const xi = Math.min(o.l - 1, (u * o.l) | 0);
        const yi = Math.min(o.h - 1, (v * o.h) | 0);
        s += o.f[yi * o.l + xi] * o.poids;
      }
      s /= total;
      out[y * L + x] = s;
      if (s < min) min = s;
      if (s > max) max = s;
    }
  }
  const etendue = max - min || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / etendue;
  return out;
}

/**
 * Carte de normales derivee du relief. C'est elle qui fait exister les
 * montagnes et les rides sous la lumiere rasante de l'etoile : sans elle, une
 * planete reste une image collee sur une sphere.
 */
function normales(h: Float32Array, L: number, H: number, force: number): THREE.CanvasTexture {
  const c = toile(L, H);
  const g = c.getContext('2d')!;
  const img = g.createImageData(L, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const yh = Math.max(0, y - 1);
    const yb = Math.min(H - 1, y + 1);
    for (let x = 0; x < L; x++) {
      const xg = (x - 1 + L) % L;
      const xd = (x + 1) % L;
      const dx = (h[y * L + xd] - h[y * L + xg]) * force;
      const dy = (h[yb * L + x] - h[yh * L + x]) * force;
      const nz = 1;
      const norme = Math.hypot(-dx, -dy, nz);
      const p = (y * L + x) * 4;
      d[p] = ((-dx / norme) * 0.5 + 0.5) * 255;
      d[p + 1] = ((-dy / norme) * 0.5 + 0.5) * 255;
      d[p + 2] = (nz / norme) * 255;
      d[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function enTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------ traits */

function crateres(g: CanvasRenderingContext2D, l: number, h: number, rng: Rng): void {
  // Beaucoup de petits impacts, quelques grands : la distribution reelle. Le
  // nombre varie fortement — un monde jeune est presque lisse, un monde ancien
  // est sature.
  // Quelques grands bassins d'impact, remplis de lave refroidie : ce sont eux
  // qui donnent a un monde criblé sa physionomie propre.
  const bassins = rng.int(0, 5);
  for (let i = 0; i < bassins; i++) {
    const x = rng.next() * l;
    const y = rng.next() * h;
    const r = (l / 512) * rng.range(38, 110);
    const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,0.38)');
    gr.addColorStop(0.82, 'rgba(0,0,0,0.2)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // Un impact recent projette des rayons clairs sur des milliers de kilometres.
  if (rng.chance(0.35)) {
    const x = rng.next() * l;
    const y = rng.next() * h;
    const rayons = rng.int(8, 22);
    for (let k = 0; k < rayons; k++) {
      const a = rng.next() * Math.PI * 2;
      const long = (l / 512) * rng.range(40, 190);
      g.strokeStyle = `rgba(255,255,255,${(0.04 + rng.next() * 0.07).toFixed(3)})`;
      g.lineWidth = 1 + rng.next() * 4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * long, y + Math.sin(a) * long);
      g.stroke();
    }
  }

  const combien = rng.int(90, 420);
  for (let i = 0; i < combien; i++) {
    const x = rng.next() * l;
    const y = rng.next() * h;
    const r = (l / 512) * (2 + rng.skewed(1, 22, 3));
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

function canyon(g: CanvasRenderingContext2D, l: number, h: number, rng: Rng): void {
  g.lineCap = 'round';

  // Un desert sur deux n'a pas de canyon mais des champs de dunes : deux
  // paysages tres differents pour un meme type de monde.
  if (rng.chance(0.45)) {
    const pas = h / rng.range(14, 40);
    const inclinaison = rng.range(-0.5, 0.5);
    for (let y = -h; y < h * 2; y += pas) {
      g.strokeStyle = `rgba(${rng.chance(0.5) ? '255,240,220' : '40,22,14'},${(0.04 + rng.next() * 0.08).toFixed(3)})`;
      g.lineWidth = 1 + rng.next() * 3.5;
      g.beginPath();
      let yy = y;
      g.moveTo(0, yy);
      for (let x = 0; x <= l; x += l / 50) {
        yy += inclinaison * (l / 50) / 8 + (rng.next() - 0.5) * 2.4;
        g.lineTo(x, yy);
      }
      g.stroke();
    }
    return;
  }

  const branches = rng.int(1, 3);
  const pente = rng.range(-0.35, 0.35);
  for (let b = 0; b < branches; b++) {
    for (let passe = 0; passe < 2; passe++) {
      g.beginPath();
      let y = h * rng.range(0.2, 0.8);
      g.moveTo(l * 0.05, y);
      for (let x = l * 0.05; x < l * 0.96; x += l / 40) {
        y += (rng.next() - 0.5) * h * 0.05 + pente * (h / 40);
        g.lineTo(x, y);
      }
      g.strokeStyle = passe === 0 ? 'rgba(40,20,14,0.42)' : 'rgba(18,8,6,0.62)';
      g.lineWidth = passe === 0 ? h * (0.03 + rng.next() * 0.025) : h * 0.014;
      g.stroke();
    }
  }
  // Ravines secondaires : le reseau qui alimente le canyon principal.
  for (let k = 0; k < 60; k++) {
    let x = rng.next() * l;
    let y = rng.next() * h;
    let a = rng.next() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 14; s++) {
      a += (rng.next() - 0.5) * 0.6;
      x += Math.cos(a) * (l / 110);
      y += Math.sin(a) * (l / 110);
      g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(30,16,10,0.22)';
    g.lineWidth = 0.6 + rng.next() * 1.6;
    g.stroke();
  }
}

function fractures(l: number, h: number, rng: Rng): HTMLCanvasElement {
  const e = toile(l, h);
  const g = e.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, l, h);
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  // Densite, largeur et chaleur du reseau varient par monde : un monde en
  // debut d'eruption ne ressemble pas a un monde entierement craquele.
  const densite = rng.int(55, 190);
  const largeur = rng.range(0.6, 1.9);
  const chaleur = rng.range(0, 1);
  const halo = `rgba(${Math.round(150 + chaleur * 90)},${Math.round(38 + chaleur * 40)},8,${(0.22 + rng.next() * 0.16).toFixed(2)})`;
  const coeur = `rgba(255,${Math.round(140 + chaleur * 80)},${Math.round(40 + chaleur * 70)},0.85)`;
  for (let k = 0; k < densite; k++) {
    const depart = { x: rng.next() * l, y: rng.next() * h };
    let angle = rng.next() * Math.PI * 2;
    const segments = 6 + rng.next() * (12 + chaleur * 26);
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
      g.strokeStyle = passe === 0 ? halo : coeur;
      g.lineWidth = passe === 0 ? (l / 95) * largeur : (l / 460) * largeur;
      g.stroke();
      angle = a;
    }
  }
  return e;
}

function veines(g: CanvasRenderingContext2D, l: number, h: number, rng: Rng): void {
  g.lineCap = 'round';
  for (let k = 0; k < 120; k++) {
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
    g.strokeStyle = `rgba(200,196,210,${0.06 + rng.next() * 0.13})`;
    g.lineWidth = 0.6 + rng.next() * 2.2;
    g.stroke();
  }
}

function banquise(g: CanvasRenderingContext2D, l: number, h: number, rng: Rng): void {
  g.lineCap = 'round';
  for (let k = 0; k < 130; k++) {
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
    g.strokeStyle = rng.next() > 0.4 ? 'rgba(74,120,150,0.34)' : 'rgba(146,102,72,0.26)';
    g.lineWidth = 0.7 + rng.next() * 2.6;
    g.stroke();
  }
}

/* --------------------------------------------------------- generateurs */

/**
 * Palette d'une geante : une famille de teintes tiree parmi celles declarees
 * pour son type, puis six paliers de clarte. Une geante n'a aucune raison
 * d'etre toujours ocre — selon sa chimie et sa temperature elle peut etre
 * turquoise, violine, sulfureuse ou presque blanche.
 */
function paletteGeante(type: TypePlanete, planete: Planete, rng: Rng): RVB[] {
  const familles = type.rendu.teintes ?? [[20, 50]];
  const [hMin, hMax] = rng.pick(familles);
  const teinte = (rng.range(hMin, hMax) / 360 + 1) % 1;
  // Une geante glacee est pale et peu saturee, une geante chaude est dense.
  const froide = planete.temperatureC < -120;
  const satBase = froide ? rng.range(0.1, 0.34) : rng.range(0.16, 0.52);
  const clarteBase = froide ? rng.range(0.4, 0.64) : rng.range(0.24, 0.5);
  // Ecart large entre bande sombre et bande claire : c'est ce qui donne du
  // relief a l'atmosphere plutot qu'un degrade pastel.
  const amplitude = rng.range(0.3, 0.66);
  const derive = rng.range(-0.06, 0.06);

  const stops: RVB[] = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    stops.push(
      versRvbDepuisTsl(
        (teinte + derive * t + 1) % 1,
        // Les bandes sombres portent la couleur, les zones claires sont des
        // nuages d'ammoniac presque blancs : c'est ainsi qu'elles se lisent.
        Math.max(0.02, Math.min(1, satBase * (1.45 - t * 1.05))),
        Math.max(0.04, Math.min(0.97, clarteBase - amplitude / 2 + amplitude * t)),
      ),
    );
  }
  return stops;
}

/** Profil de bandes en latitude : une somme de sinusoides, jamais deux fois la meme. */
function profilBandes(H: number, rng: Rng, composantes: number, nettete: number): Float32Array {
  const freqs: number[] = [];
  const phases: number[] = [];
  const amps: number[] = [];
  for (let i = 0; i < composantes; i++) {
    freqs.push(rng.range(1.2, 3 + i * 4));
    phases.push(rng.next() * Math.PI * 2);
    amps.push(1 / (1 + i * 0.8));
  }
  const total = amps.reduce((a, b) => a + b, 0);
  const p = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    let s = 0;
    for (let i = 0; i < composantes; i++) s += Math.sin(v * Math.PI * freqs[i] * 2 + phases[i]) * amps[i];
    s = s / total * 0.5 + 0.5;
    // La nettete durcit ou adoucit la transition entre deux bandes.
    p[y] = nettete === 1 ? s : Math.max(0, Math.min(1, (s - 0.5) * nettete + 0.5));
  }
  return p;
}

type MotifGeante = 'bandes' | 'turbulent' | 'tempetes' | 'rayures' | 'polaire' | 'voile';

function surfaceGeante(type: TypePlanete, planete: Planete, rng: Rng): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const L = 1024;
  const H = 512;
  const c = toile(L, H);
  const g = c.getContext('2d')!;
  const palette = paletteGeante(type, planete, rng);

  const poids = type.rendu.motifs ?? { bandes: 1 };
  const motifs = Object.keys(poids) as MotifGeante[];
  const motif = rng.weighted(motifs, (m) => poids[m]);

  // Chaque motif est un climat : nombre de bandes, nettete, ampleur des
  // tourbillons et nombre de tempetes en decoulent.
  const reglages: Record<
    MotifGeante,
    { composantes: number; nettete: number; warp: number; tempetes: [number, number]; grain: number; paliers: number }
  > = {
    bandes: { composantes: rng.int(5, 9), nettete: 2.2, warp: 0.022, tempetes: [1, 4], grain: 0.5, paliers: 0 },
    turbulent: { composantes: rng.int(3, 6), nettete: 1.5, warp: 0.16, tempetes: [4, 11], grain: 1, paliers: 0 },
    tempetes: { composantes: rng.int(2, 5), nettete: 1.6, warp: 0.08, tempetes: [10, 26], grain: 0.8, paliers: 0 },
    rayures: { composantes: rng.int(9, 14), nettete: 4.5, warp: 0.014, tempetes: [0, 3], grain: 0.3, paliers: rng.int(7, 14) },
    polaire: { composantes: rng.int(3, 6), nettete: 2.6, warp: 0.035, tempetes: [1, 5], grain: 0.45, paliers: 0 },
    voile: { composantes: rng.int(1, 3), nettete: 0.7, warp: 0.06, tempetes: [0, 2], grain: 0.25, paliers: 0 },
  };
  const r = reglages[motif];

  // Deformation du domaine : c'est elle qui donne l'aspect marbre plutot que
  // des rubans peints au pinceau plat.
  const warp = champ(128, 64, 40, 13, rng, 2);
  const grain = champ(256, 128, 300, 6, rng, 1);
  const SUR = 4;
  const profil = profilBandes(H * SUR, rng, r.composantes, r.nettete);

  const img = g.createImageData(L, H);
  const d = img.data;
  const altitude = new Float32Array(L * H);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    const lat = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < L; x++) {
      const u = (x + 0.5) / L;
      const decalage = (lire(warp, 128, 64, u, v) - 0.5) * r.warp;
      const iy = Math.max(0, Math.min(H * SUR - 1, Math.round((v + decalage) * H * SUR)));
      let n = profil[iy];
      n += (lire(grain, 256, 128, u, v) - 0.5) * 0.16 * r.grain;
      n = Math.max(0, Math.min(1, n));
      // Rayures : des paliers francs plutot qu'un degrade continu.
      if (r.paliers) n = Math.round(n * r.paliers) / r.paliers;
      altitude[y * L + x] = n;
      let col = rampe(palette, n);
      // Assombrissement polaire : les poles d'une geante sont toujours plus sombres.
      if (motif === 'polaire' && lat > 0.72) {
        col = melange(col, palette[0], Math.min(1, (lat - 0.72) / 0.28) * 0.85);
      } else if (lat > 0.86) {
        col = melange(col, palette[1], (lat - 0.86) / 0.14 * 0.4);
      }
      const p = (y * L + x) * 4;
      d[p] = col[0];
      d[p + 1] = col[1];
      d[p + 2] = col[2];
      d[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // Fines striations : le detail qui apparait quand on s'approche.
  g.globalAlpha = 0.5;
  for (let k = 0; k < 260; k++) {
    const y = rng.next() * H;
    const clair = rng.chance(0.5);
    const t = clair ? palette[5] : palette[0];
    g.strokeStyle = `rgba(${t.map(Math.round).join(',')},${(0.05 + rng.next() * 0.14).toFixed(2)})`;
    g.lineWidth = 0.6 + rng.next() * 2.2;
    g.beginPath();
    const x0 = rng.next() * L;
    g.moveTo(x0, y);
    let yy = y;
    for (let x = x0; x < x0 + L * rng.range(0.15, 0.7); x += L / 60) {
      yy += (rng.next() - 0.5) * 2.6;
      g.lineTo(x % L === x ? x : x, yy);
    }
    g.stroke();
  }
  g.globalAlpha = 1;

  // Volutes etirees le long des bandes.
  if ('filter' in g) g.filter = 'blur(3px)';
  const volutes = Math.round(120 + r.grain * 420);
  for (let k = 0; k < volutes; k++) {
    const y = rng.next() * H;
    const lat = Math.abs(y - H / 2) / (H / 2);
    const clair = rng.next() > 0.5;
    const teinte = clair ? palette[5] : palette[0];
    g.fillStyle = `rgba(${teinte.map(Math.round).join(',')},${(0.07 + rng.next() * 0.1).toFixed(2)})`;
    g.beginPath();
    g.ellipse(rng.next() * L, y, 18 + rng.next() * 220 * (1 - lat * 0.6) * (0.4 + r.warp * 5),
      1.5 + rng.next() * 6, (rng.next() - 0.5) * 0.14, 0, Math.PI * 2);
    g.fill();
  }
  if ('filter' in g) g.filter = 'none';

  // Tempetes : des ovales a contre-teinte, parfois un oeil geant.
  const nbTempetes = rng.int(r.tempetes[0], r.tempetes[1]);
  for (let k = 0; k < nbTempetes; k++) {
    const x = rng.next() * L;
    const y = H * rng.range(0.18, 0.82);
    const rx = (12 + rng.skewed(4, 90, 2)) * (motif === 'tempetes' ? 0.7 : 1);
    const ry = rx * rng.range(0.3, 0.55);
    const chaud = rng.chance(0.5);
    const noyau = chaud ? palette[5] : palette[0];
    const bord = chaud ? palette[3] : palette[1];
    if ('filter' in g) g.filter = 'blur(2px)';
    // Bourrelet exterieur, puis oeil : une tempete se lit a son anneau.
    g.strokeStyle = `rgba(${palette[0].map(Math.round).join(',')},0.4)`;
    g.lineWidth = rx * 0.14;
    g.beginPath();
    g.ellipse(x, y, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = `rgba(${bord.map(Math.round).join(',')},0.72)`;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(${noyau.map(Math.round).join(',')},0.8)`;
    g.beginPath();
    g.ellipse(x, y, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    if ('filter' in g) g.filter = 'none';
  }

  // Un relief tres doux sur les sommets nuageux : assez pour que les bandes
  // accrochent la lumiere, jamais assez pour ressembler a du rocher.
  return { map: enTexture(c), normal: normales(altitude, L, H, 1.6) };
}

function surfaceTellurique(
  type: TypePlanete,
  planete: Planete,
  rng: Rng,
  L: number,
): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture; emissive?: THREE.CanvasTexture } {
  const H = L / 2;
  const palette = paletteDuMonde(type, planete, rng);
  const trait = type.rendu.trait;

  // L'echelle du relief varie : certains mondes ont de vastes plaques, d'autres
  // un decoupage serre. C'est ce qui distingue deux mondes de meme type.
  const h = relief(L, H, rng, rng.range(0.6, 1.5));

  // Niveau des mers propre au monde : un continent unique ou un archipel.
  const mer = rng.range(0.34, 0.55);
  const neige = 0.72 + rng.range(-0.06, 0.1);
  const glace: RVB = [226, 238, 244];
  // La calotte polaire recule sur un monde chaud, descend sur un monde froid.
  const latGlace = Math.max(0.62, Math.min(0.97, 0.86 - planete.temperatureC / 260));

  const c = toile(L, H);
  const g = c.getContext('2d')!;
  const img = g.createImageData(L, H);
  const d = img.data;

  for (let y = 0; y < H; y++) {
    const lat = Math.abs((y + 0.5) / H - 0.5) * 2;
    for (let x = 0; x < L; x++) {
      const n = h[y * L + x];
      let col: RVB;
      if (trait === 'continents') {
        if (n < mer) col = melange(palette[0], palette[1], n / mer);
        else if (n < mer + 0.05) col = melange(palette[1], palette[3], (n - mer) / 0.05);
        else if (n < neige) col = melange(palette[2], palette[1], (n - mer - 0.05) / (neige - mer - 0.05));
        else col = melange(palette[2], palette[3], (n - neige) / (1 - neige));
        if (lat > latGlace) col = melange(col, glace, Math.min(1, (lat - latGlace) / 0.16));
      } else if (trait === 'oceans') {
        const merO = mer + 0.18;
        if (n < merO) col = melange(palette[0], palette[1], n / merO);
        else if (n < merO + 0.2) col = melange(palette[1], palette[2], (n - merO) / 0.2);
        else col = melange(palette[2], palette[3], (n - merO - 0.2) / Math.max(0.05, 0.8 - merO));
        if (lat > latGlace) col = melange(col, glace, Math.min(1, (lat - latGlace) / 0.14));
      } else if (trait === 'banquise') {
        col = rampe(palette, 0.3 + n * 0.7);
        if (n > 0.7) col = melange(col, [176, 138, 98], ((n - 0.7) / 0.3) * 0.55);
      } else if (trait === 'voile') {
        // Un monde de serre ne montre pas son sol : on ne voit que la brume.
        col = rampe(palette, 0.45 + n * 0.5);
      } else {
        col = rampe(palette, n);
        if (lat > 0.9 && trait === 'canyon') col = melange(col, [214, 208, 202], (lat - 0.9) / 0.1);
      }
      const p = (y * L + x) * 4;
      d[p] = col[0];
      d[p + 1] = col[1];
      d[p + 2] = col[2];
      d[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  if (trait === 'crateres') crateres(g, L, H, rng);
  if (trait === 'canyon') canyon(g, L, H, rng);
  if (trait === 'veines') veines(g, L, H, rng);
  if (trait === 'banquise') banquise(g, L, H, rng);

  // Le relief se ressent plus sur un monde nu que sous une atmosphere epaisse.
  const forceRelief = trait === 'voile' ? 1.2 : trait === 'oceans' ? 2.4 : trait === 'continents' ? 3.4 : 5;
  const resultat: { map: THREE.CanvasTexture; normal: THREE.CanvasTexture; emissive?: THREE.CanvasTexture } = {
    map: enTexture(c),
    normal: normales(h, L, H, forceRelief * (L / 512)),
  };

  if (trait === 'fractures') {
    const e = fractures(L, H, rng);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(e, 0, 0);
    g.globalCompositeOperation = 'source-over';
    resultat.map = enTexture(c);
    resultat.emissive = enTexture(e);
  }
  return resultat;
}

function nuages(rng: Rng, densite: number): THREE.CanvasTexture {
  const L = 512;
  const H = 256;
  const grand = champ(128, 64, 30, 14, rng, 2);
  const fin = champ(256, 128, 220, 7, rng, 1);
  const c = toile(L, H);
  const g = c.getContext('2d')!;
  const img = g.createImageData(L, H);
  const d = img.data;
  const seuil = 0.46 + rng.range(-0.08, 0.12);
  for (let y = 0; y < H; y++) {
    const lat = Math.abs(y / H - 0.5) * 2;
    for (let x = 0; x < L; x++) {
      const n = lire(grand, 128, 64, (x + 0.5) / L, (y + 0.5) / H) * 0.72 +
        lire(fin, 256, 128, (x + 0.5) / L, (y + 0.5) / H) * 0.28;
      let a = Math.max(0, (n - seuil) / (1 - seuil));
      // Bandes de convection : nuageux a l'equateur et aux moyennes latitudes.
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

/**
 * Anneaux. Leur teinte dit de quoi ils sont faits : glace brillante autour d'un
 * monde froid, poussiere rocheuse sombre autour d'un monde chaud.
 */
export function textureAnneaux(rng: Rng, temperatureC = -120): THREE.CanvasTexture {
  const L = 512;
  const c = toile(L, 1);
  const g = c.getContext('2d')!;
  const img = g.createImageData(L, 1);
  const d = img.data;
  const glace = temperatureC < -60;
  const base: RVB = glace
    ? [206 + rng.range(-14, 14), 216 + rng.range(-10, 10), 222 + rng.range(-6, 12)]
    : [172 + rng.range(-30, 24), 148 + rng.range(-28, 20), 126 + rng.range(-26, 18)];
  for (let x = 0; x < L; x++) {
    const u = x / L;
    let a = u < 0.2 ? 0.28 + u * 1.1 : u < 0.58 ? 0.9 : u < 0.84 ? 0.66 : 0.3;
    if (u < 0.05 || (u > 0.58 && u < 0.63) || (u > 0.86 && u < 0.875) || u > 0.97) a *= 0.07;
    const s = Math.sin(u * 230) * 0.5 + Math.sin(u * 88 + 1.9) * 0.35 + Math.sin(u * 520 + 0.4) * 0.25;
    a = Math.max(0, Math.min(1, a * (0.8 + s * 0.2 + (rng.next() - 0.5) * 0.08)));
    const b = 0.84 + s * 0.16;
    const p = x * 4;
    d[p] = base[0] * b;
    d[p + 1] = base[1] * b;
    d[p + 2] = base[2] * b;
    d[p + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = enTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Surface de lune : petite, criblee, sans atmosphere pour effacer les impacts. */
export function textureLune(rng: Rng): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const L = 256;
  const H = 128;
  const h = relief(L, H, rng, 1.2);
  const c = toile(L, H);
  const g = c.getContext('2d')!;
  const img = g.createImageData(L, H);
  const d = img.data;
  const teinte = rng.range(-14, 22);
  for (let i = 0; i < L * H; i++) {
    const v = 74 + h[i] * 96;
    const p = i * 4;
    d[p] = v + teinte;
    d[p + 1] = v + teinte * 0.6;
    d[p + 2] = v;
    d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  crateres(g, L, H, rng);
  return { map: enTexture(c), normal: normales(h, L, H, 4) };
}

export interface TexturesMonde {
  map: THREE.Texture;
  normal?: THREE.Texture;
  emissive?: THREE.Texture;
  nuages?: THREE.Texture;
}

export function texturesMonde(
  planete: Planete,
  type: TypePlanete,
  germe: string,
  idSysteme: number,
): TexturesMonde {
  const rng = new Rng(`${germe}:${idSysteme}:${planete.id}:surface`);

  if (type.categorie === 'geante') return surfaceGeante(type, planete, rng);

  // Les grands mondes meritent plus de definition : on les regarde de plus pres.
  const L = planete.rayonKm > 9000 ? 768 : 512;
  const base = surfaceTellurique(type, planete, rng, L);
  const resultat: TexturesMonde = { map: base.map, normal: base.normal };
  if (base.emissive) resultat.emissive = base.emissive;

  const densite =
    type.rendu.trait === 'continents' || type.rendu.trait === 'oceans' ? 1 :
    type.rendu.trait === 'voile' ? 1.6 : 0;
  if (densite > 0) resultat.nuages = nuages(rng, densite);
  return resultat;
}

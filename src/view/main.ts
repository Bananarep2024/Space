/**
 * Visualiseur de galaxie.
 *
 * Cette couche ne decide rien : elle lit ce que le noyau a genere et le dessine.
 * Aucun calcul de jeu ne doit apparaitre ici — c'est ce qui permettra de la
 * remplacer par une scene Unity sans toucher aux regles.
 */

import * as THREE from 'three';
import {
  CONFIG,
  PALIER_MAX,
  accessibilite,
  classeStellaire,
  formaterDuree,
  genererGalaxie,
  germeAleatoire,
  porteeDe,
  ressource,
  typePlanete,
} from '../core/index';
import type { Galaxie, Systeme } from '../core/types';

/* ------------------------------------------------------------------ scene */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070e, 0.0042);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 1200);

/* fond etoile lointain, purement decoratif */
{
  const N = 2200;
  const p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 400 + Math.random() * 400;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    p[i * 3] = r * Math.sin(ph) * Math.cos(th);
    p[i * 3 + 1] = r * Math.cos(ph);
    p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8ea3b8, size: 1.2, transparent: true, opacity: 0.5 })));
}

function pastille(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.16, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.42, 'rgba(255,255,255,0.24)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const TEXTURE_ETOILE = pastille();

/* ------------------------------------------------------------------ etat */

let galaxie: Galaxie;
let palier = 0;
let selection = -1;
let departJoueur = 0;
let tempsDepuisDepart: number[] = [];

const groupe = new THREE.Group();
scene.add(groupe);

let etoiles: THREE.Points;
let couleursBase: Float32Array;

/* ------------------------------------------------------------- rendu carte */

function construire(g: Galaxie): void {
  groupe.clear();
  const n = g.systemes.length;

  // 1. Etoiles
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const taille = new Float32Array(n);
  const c = new THREE.Color();
  g.systemes.forEach((s, i) => {
    pos.set(s.pos, i * 3);
    const classe = classeStellaire(s.classe);
    c.set(classe.couleur);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    taille[i] = classe.taille;
  });
  couleursBase = col.slice();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('taille', new THREE.BufferAttribute(taille, 1));
  etoiles = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { carte: { value: TEXTURE_ETOILE } },
      vertexShader: `
        attribute float taille;
        varying vec3 vCol;
        void main(){
          vCol = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(3.5, taille * 900.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D carte;
        varying vec3 vCol;
        void main(){
          vec4 t = texture2D(carte, gl_PointCoord);
          gl_FragColor = vec4(vCol, 1.0) * t;
        }`,
      vertexColors: true,
    }),
  );
  groupe.add(etoiles);

  // 2. Routes : les courtes sont praticables d'emblee, les longues attendent la propulsion.
  const courtes: number[] = [];
  const longues: number[] = [];
  for (const r of g.routes) {
    const cible = r.d <= porteeDe(palier) ? courtes : longues;
    cible.push(...g.systemes[r.a].pos, ...g.systemes[r.b].pos);
  }
  const ligne = (points: number[], couleur: number, opacite: number) => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    return new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: opacite }));
  };
  groupe.add(ligne(courtes, 0x50637a, 0.42));
  groupe.add(ligne(longues, 0x3a4a5e, 0.16));

  // 3. Trous de ver : ils court-circuitent quarante minutes de trajet.
  const trous: number[] = [];
  for (const t of g.trousDeVer) trous.push(...g.systemes[t.a].pos, ...g.systemes[t.b].pos);
  if (trous.length) {
    const l = ligne(trous, 0xe9a94e, 0.3);
    (l.material as THREE.LineBasicMaterial).depthWrite = false;
    groupe.add(l);
  }

  // 4. Nebuleuses : aucune route ne les traverse, elles obligent a contourner.
  for (const neb of g.nebuleuses) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(neb.rayonAl, 24, 18),
      new THREE.MeshBasicMaterial({
        color: 0x4a6a9a, transparent: true, opacity: 0.07,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
      }),
    );
    m.position.set(...neb.centre);
    groupe.add(m);
  }
}

/* --------------------------------------------------------- accessibilite */

/** Recolore la carte selon ce que le joueur peut atteindre au palier courant. */
function majAccessibilite(): void {
  const depart = galaxie.systemes.find((s) => s.joueurDepart === departJoueur);
  if (!depart || !etoiles) return;
  tempsDepuisDepart = accessibilite(galaxie, depart.id, 'eclaireur', palier).temps;

  const col = etoiles.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = col.array as Float32Array;
  for (let i = 0; i < galaxie.systemes.length; i++) {
    const t = tempsDepuisDepart[i];
    // Plus c'est loin, plus l'etoile s'eteint : la carte montre l'empire possible,
    // pas seulement la geographie.
    const f = !isFinite(t) ? 0.24 : t < 600 ? 1 : t < 1500 ? 0.78 : t < 2400 ? 0.56 : 0.4;
    arr[i * 3] = couleursBase[i * 3] * f;
    arr[i * 3 + 1] = couleursBase[i * 3 + 1] * f;
    arr[i * 3 + 2] = couleursBase[i * 3 + 2] * f;
  }
  col.needsUpdate = true;

  const dansLes10 = tempsDepuisDepart.filter((t, i) => i !== depart.id && t <= 600).length;
  const atteignables = tempsDepuisDepart.filter((t) => isFinite(t)).length;
  const plusLoin = Math.max(...tempsDepuisDepart.filter((t) => isFinite(t)));
  document.getElementById('prop-info')!.innerHTML =
    `portee de saut <b>${porteeDe(palier)} al</b><br>` +
    `a moins de 10 min <b>${dansLes10} systemes</b><br>` +
    `atteignables <b>${atteignables} / ${galaxie.systemes.length}</b><br>` +
    `bout de la galaxie <b>${formaterDuree(plusLoin)}</b>`;
}

/* ------------------------------------------------------------------ fiche */

const card = document.getElementById('card')!;

function fiche(i: number): void {
  selection = i;
  // La fiche occupe le flanc droit sur grand ecran : les boutons se decalent
  // pour ne pas passer par-dessus.
  document.body.classList.toggle('fiche-ouverte', i >= 0);
  if (i < 0) { card.classList.remove('open'); return; }
  const s = galaxie.systemes[i];
  const classe = classeStellaire(s.classe);
  const t = tempsDepuisDepart[i];

  document.getElementById('c-nom')!.textContent = s.nom;
  document.getElementById('c-kind')!.textContent =
    `${classe.nom} ${s.classe} · ${s.planetes.length} monde${s.planetes.length > 1 ? 's' : ''}` +
    (s.joueurDepart !== null ? ' · position de depart' : '');

  const infos: Record<string, string> = {
    'Distance': `${Math.hypot(...s.pos).toFixed(1)} al du centre`,
    'Luminosite': `${classe.luminosite} L☉`,
    'Sauts directs': String(s.voisins.length),
    'Trajet': isFinite(t) ? formaterDuree(t) : "hors d'atteinte",
    'Mondes habitables': String(s.habitables),
    'Nebuleuse': s.nebuleuse !== null ? galaxie.nebuleuses[s.nebuleuse].nom : '—',
  };
  const grid = document.getElementById('c-grid')!;
  grid.innerHTML = '';
  for (const [k, v] of Object.entries(infos)) {
    const d = document.createElement('div');
    d.innerHTML = `<dt>${k}</dt><dd>${v}</dd>`;
    grid.appendChild(d);
  }

  const mondes = document.getElementById('c-mondes')!;
  mondes.innerHTML = '';
  for (const p of s.planetes) {
    const type = typePlanete(p.type);
    const el = document.createElement('div');
    el.className = 'monde' + (p.habitable ? ' hab' : '');
    const res = p.gisements
      .map((g) => `<span>${g.nomUnique ?? ressource(g.ressource).nom} <i>${g.richesse}</i></span>`)
      .join('');
    el.innerHTML =
      `<div class="l1"><i style="background:${type.couleur}"></i><b>${p.nom}</b>` +
      `<span>hab ${p.habitabilite}${p.habitable ? ' ◆' : ''}</span></div>` +
      `<div class="l2">${type.nom} · ${p.distanceUA} UA · ${p.temperatureC} °C · ${p.graviteG} g` +
      `${p.lunes.length ? ` · ${p.lunes.length} lune${p.lunes.length > 1 ? 's' : ''}` : ''}` +
      `${p.anneaux ? ' · anneaux' : ''}</div>` +
      `<div class="res">${res}</div>` +
      (p.vie ? `<div class="note">${p.vie.nom} — ${p.vie.description}</div>` : '') +
      (p.artefact ? '<div class="note">Signal artificiel enfoui : artefact probable.</div>' : '') +
      (p.dangers.length ? `<div class="danger">${p.dangers.join(' · ')}</div>` : '');
    mondes.appendChild(el);
  }
  card.classList.add('open');

  cible.set(...s.pos);
  distanceCible = Math.min(distanceCible, 90);
}

/* --------------------------------------------------------------- camera */

const cible = new THREE.Vector3();
let theta = 0.7;
let phi = 1.15;
let distanceCamera = 260;
let distanceCible = 260;
let cibleTheta = theta;
let cibleP = phi;
const cibleLisse = new THREE.Vector3();

function placer(): void {
  cibleLisse.lerp(cible, 0.1);
  camera.position.set(
    cibleLisse.x + distanceCamera * Math.sin(phi) * Math.sin(theta),
    cibleLisse.y + distanceCamera * Math.cos(phi),
    cibleLisse.z + distanceCamera * Math.sin(phi) * Math.cos(theta),
  );
  camera.lookAt(cibleLisse);
}

const el = renderer.domElement;
const pointeurs: Record<number, { x: number; y: number }> = {};
let dernier: { x: number; y: number } | null = null;
let pince = 0;
let bouge = 0;

const aide = document.getElementById('aide');
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  pointeurs[e.pointerId] = { x: e.clientX, y: e.clientY };
  dernier = { x: e.clientX, y: e.clientY };
  bouge = 0;
  aide?.classList.add('off');
});
el.addEventListener('pointermove', (e) => {
  if (!pointeurs[e.pointerId] || !dernier) return;
  pointeurs[e.pointerId] = { x: e.clientX, y: e.clientY };
  const ids = Object.keys(pointeurs);
  if (ids.length >= 2) {
    const a = pointeurs[Number(ids[0])];
    const b = pointeurs[Number(ids[1])];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pince) distanceCible = Math.max(20, Math.min(520, (distanceCible * pince) / d));
    pince = d;
    bouge = 99;
    return;
  }
  bouge += Math.abs(e.clientX - dernier.x) + Math.abs(e.clientY - dernier.y);
  cibleTheta -= (e.clientX - dernier.x) * 0.005;
  cibleP = Math.max(0.18, Math.min(Math.PI - 0.18, cibleP - (e.clientY - dernier.y) * 0.004));
  dernier = { x: e.clientX, y: e.clientY };
});
function relacher(e: PointerEvent): void {
  if (bouge < 6 && pointeurs[e.pointerId]) viser(e.clientX, e.clientY);
  delete pointeurs[e.pointerId];
  pince = 0;
  dernier = null;
}
el.addEventListener('pointerup', relacher);
el.addEventListener('pointercancel', (e) => { delete pointeurs[e.pointerId]; pince = 0; dernier = null; });
el.addEventListener('wheel', (e) => {
  e.preventDefault();
  distanceCible = Math.max(20, Math.min(520, distanceCible + e.deltaY * 0.09));
}, { passive: false });

const rayon = new THREE.Raycaster();
rayon.params.Points = { threshold: 2.6 };
const ndc = new THREE.Vector2();

function viser(px: number, py: number): void {
  ndc.x = (px / innerWidth) * 2 - 1;
  ndc.y = -(py / innerHeight) * 2 + 1;
  rayon.setFromCamera(ndc, camera);
  const touches = rayon.intersectObject(etoiles, false);
  if (touches.length && touches[0].index !== undefined) fiche(touches[0].index);
  else fiche(-1);
}

/* ------------------------------------------------------------- etiquettes */

let etiquettes: { el: HTMLElement; systeme: Systeme }[] = [];

function poserEtiquettes(): void {
  for (const e of etiquettes) e.el.remove();
  etiquettes = galaxie.systemes
    .filter((s) => s.joueurDepart !== null)
    .map((s) => {
      const d = document.createElement('div');
      d.className = 'lbl home';
      d.innerHTML = `${s.nom}<em>depart ${(s.joueurDepart ?? 0) + 1}</em>`;
      document.body.appendChild(d);
      return { el: d, systeme: s };
    });
}

/* ------------------------------------------------------------- interface */

function paliers(): void {
  const hote = document.getElementById('paliers')!;
  hote.innerHTML = '';
  for (let p = 0; p <= PALIER_MAX; p++) {
    const b = document.createElement('button');
    b.textContent = String(p);
    b.className = p === palier ? 'on' : '';
    b.onclick = () => {
      palier = p;
      construire(galaxie);
      majAccessibilite();
      paliers();
      if (selection >= 0) fiche(selection);
    };
    hote.appendChild(b);
  }
}

function charger(germe: string): void {
  galaxie = genererGalaxie({ germe, systemes: CONFIG.carte.tailles.standard, joueurs: 6 });
  selection = -1;
  card.classList.remove('open');
  construire(galaxie);
  majAccessibilite();
  poserEtiquettes();
  document.getElementById('titre')!.textContent = germe;
  document.getElementById('sous-titre')!.textContent =
    `${galaxie.systemes.length} systemes · ` +
    `${galaxie.systemes.reduce((n, s) => n + s.planetes.length, 0)} mondes · ` +
    `${galaxie.routes.length} routes · ${galaxie.trousDeVer.length} trous de ver`;
}

document.getElementById('b-neuf')!.onclick = () => charger(germeAleatoire());
document.getElementById('b-vue')!.onclick = () => {
  cible.set(0, 0, 0);
  distanceCible = 260;
  fiche(-1);
};
document.getElementById('b-depart')!.onclick = () => {
  const s = galaxie.systemes.find((x) => x.joueurDepart === departJoueur);
  if (s) fiche(s.id);
};
document.getElementById('close')!.onclick = () => fiche(-1);

const champ = document.getElementById('q') as HTMLInputElement;
const hits = document.getElementById('hits')!;
champ.oninput = () => {
  const q = champ.value.trim().toLowerCase();
  hits.innerHTML = '';
  if (q.length < 2) return;
  galaxie.systemes
    .filter((s) => s.nom.toLowerCase().includes(q))
    .slice(0, 6)
    .forEach((s) => {
      const b = document.createElement('button');
      b.innerHTML = `${s.nom}<span>${s.planetes.length} mondes</span>`;
      b.onclick = () => { fiche(s.id); hits.innerHTML = ''; champ.value = ''; };
      hits.appendChild(b);
    });
};

/* ---------------------------------------------------------------- boucle */

const v = new THREE.Vector3();
function image(): void {
  requestAnimationFrame(image);
  theta += (cibleTheta - theta) * 0.09;
  phi += (cibleP - phi) * 0.09;
  distanceCamera += (distanceCible - distanceCamera) * 0.09;
  placer();

  for (const { el: div, systeme } of etiquettes) {
    v.set(...systeme.pos).project(camera);
    const sx = (v.x * 0.5 + 0.5) * innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * innerHeight;
    div.style.transform = `translate(-50%,-100%) translate(${sx}px,${sy - 10}px)`;
    div.classList.toggle('off', v.z > 1);
  }
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

paliers();
charger(germeAleatoire());
image();

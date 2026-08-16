/**
 * Orchestration des vues.
 *
 * Deux vues partagent un seul rendu : la carte de saut, qui montre la galaxie,
 * et la vue systeme, qui montre les mondes d'un systeme en volume. Cette couche
 * ne decide rien du jeu — elle lit ce que le noyau a genere et route les
 * gestes vers la vue active.
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
import type { Galaxie, Planete, Systeme } from '../core/types';
import { materiauEtoiles, pastille } from './sprites';
import { VueSysteme } from './vue-systeme';

type Mode = 'galaxie' | 'systeme';

/* ------------------------------------------------------------------ rendu */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const sceneGalaxie = new THREE.Scene();
sceneGalaxie.fog = new THREE.FogExp2(0x05070e, 0.0042);
const cameraGalaxie = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 1200);

const vueSysteme = new VueSysteme();
vueSysteme.camera.aspect = innerWidth / innerHeight;
vueSysteme.camera.updateProjectionMatrix();

{
  const N = 2200;
  const p = new Float32Array(N * 3);
  const c = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 400 + Math.random() * 400;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    p[i * 3] = r * Math.sin(ph) * Math.cos(th);
    p[i * 3 + 1] = r * Math.cos(ph);
    p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    const b = 0.4 + Math.random() * 0.5;
    c[i * 3] = b * 0.86;
    c[i * 3 + 1] = b * 0.94;
    c[i * 3 + 2] = b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  sceneGalaxie.add(new THREE.Points(geo, materiauEtoiles(2.6, 0.55)));
}

const TEXTURE_ETOILE = pastille();

/* ------------------------------------------------------------------ etat */

let galaxie: Galaxie;
let mode: Mode = 'galaxie';
let palier = 0;
let systemeChoisi = -1;
let mondeChoisi = -1;
const departJoueur = 0;
let tempsDepuisDepart: number[] = [];

const groupe = new THREE.Group();
sceneGalaxie.add(groupe);
let etoiles: THREE.Points;
let couleursBase: Float32Array;

const $ = (id: string) => document.getElementById(id)!;
const card = $('card');

/* ------------------------------------------------------------ carte de saut */

function construireCarte(g: Galaxie): void {
  groupe.clear();
  const n = g.systemes.length;

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
        void main(){ gl_FragColor = vec4(vCol, 1.0) * texture2D(carte, gl_PointCoord); }`,
      vertexColors: true,
    }),
  );
  groupe.add(etoiles);

  // Les routes courtes sont praticables d'emblee, les longues attendent la propulsion.
  const courtes: number[] = [];
  const longues: number[] = [];
  for (const r of g.routes) {
    (r.d <= porteeDe(palier) ? courtes : longues).push(...g.systemes[r.a].pos, ...g.systemes[r.b].pos);
  }
  const ligne = (points: number[], couleur: number, opacite: number) => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    return new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: opacite }));
  };
  groupe.add(ligne(courtes, 0x50637a, 0.42));
  groupe.add(ligne(longues, 0x3a4a5e, 0.16));

  const trous: number[] = [];
  for (const t of g.trousDeVer) trous.push(...g.systemes[t.a].pos, ...g.systemes[t.b].pos);
  if (trous.length) groupe.add(ligne(trous, 0xe9a94e, 0.3));

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

/** Recolore la carte selon ce que le joueur peut atteindre au palier courant. */
function majAccessibilite(): void {
  const depart = galaxie.systemes.find((s) => s.joueurDepart === departJoueur);
  if (!depart || !etoiles) return;
  tempsDepuisDepart = accessibilite(galaxie, depart.id, 'eclaireur', palier).temps;

  const col = etoiles.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = col.array as Float32Array;
  for (let i = 0; i < galaxie.systemes.length; i++) {
    const t = tempsDepuisDepart[i];
    const f = !isFinite(t) ? 0.24 : t < 600 ? 1 : t < 1500 ? 0.78 : t < 2400 ? 0.56 : 0.4;
    arr[i * 3] = couleursBase[i * 3] * f;
    arr[i * 3 + 1] = couleursBase[i * 3 + 1] * f;
    arr[i * 3 + 2] = couleursBase[i * 3 + 2] * f;
  }
  col.needsUpdate = true;

  const dansLes10 = tempsDepuisDepart.filter((t, i) => i !== depart.id && t <= 600).length;
  const atteignables = tempsDepuisDepart.filter((t) => isFinite(t)).length;
  const plusLoin = Math.max(...tempsDepuisDepart.filter((t) => isFinite(t)));
  $('prop-info').innerHTML =
    `portee <b>${porteeDe(palier)} al</b><br>` +
    `a moins de 10 min <b>${dansLes10} systemes</b><br>` +
    `atteignables <b>${atteignables} / ${galaxie.systemes.length}</b><br>` +
    `bout de la galaxie <b>${formaterDuree(plusLoin)}</b>`;
}

/* ------------------------------------------------------------------ fiches */

/** Rang orbital en chiffres romains, comme dans un catalogue d'exploration. */
function romain(n: number): string {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n - 1] ?? String(n);
}

function ligneGrille(hote: HTMLElement, infos: Record<string, string>): void {
  hote.innerHTML = '';
  for (const [k, v] of Object.entries(infos)) {
    const d = document.createElement('div');
    d.innerHTML = `<dt>${k}</dt><dd>${v}</dd>`;
    hote.appendChild(d);
  }
}

function ficheSysteme(i: number): void {
  systemeChoisi = i;
  mondeChoisi = -1;
  document.body.classList.toggle('fiche-ouverte', i >= 0);
  ($('b-entrer') as HTMLButtonElement).hidden = i < 0;
  $('c-hook').hidden = true;
  if (i < 0) { card.classList.remove('open'); return; }

  const s = galaxie.systemes[i];
  const classe = classeStellaire(s.classe);
  const t = tempsDepuisDepart[i];

  $('c-nom').textContent = s.nom;
  $('c-kind').textContent =
    `${classe.nom} ${s.classe} · ${s.planetes.length} monde${s.planetes.length > 1 ? 's' : ''}` +
    (s.joueurDepart !== null ? ' · position de depart' : '');

  ligneGrille($('c-grid'), {
    'Distance': `${Math.hypot(...s.pos).toFixed(1)} al du centre`,
    'Luminosite': `${classe.luminosite} L☉`,
    'Sauts directs': String(s.voisins.length),
    'Trajet': isFinite(t) ? formaterDuree(t) : "hors d'atteinte",
    'Mondes habitables': String(s.habitables),
    'Nebuleuse': s.nebuleuse !== null ? galaxie.nebuleuses[s.nebuleuse].nom : '—',
  });

  const corps = $('c-corps');
  corps.innerHTML = '<div class="sec">Mondes</div><div class="mondes"></div>';
  const liste = corps.querySelector('.mondes')!;
  s.planetes.forEach((p) => {
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
    liste.appendChild(el);
  });

  card.classList.add('open');
  cibleGalaxie.set(...s.pos);
  distanceCible = Math.min(distanceCible, 90);
}

function fichePlanete(orbite: number): void {
  mondeChoisi = orbite;
  const s = vueSysteme.systeme;
  if (!s || orbite < 0) {
    document.body.classList.remove('fiche-ouverte');
    card.classList.remove('open');
    return;
  }
  const p: Planete = s.planetes[orbite];
  const type = typePlanete(p.type);
  document.body.classList.add('fiche-ouverte');
  ($('b-entrer') as HTMLButtonElement).hidden = true;

  $('c-nom').textContent = p.nom;
  $('c-kind').textContent = `${type.nom} · ${s.nom} ${romain(orbite + 1)}`;

  const accroche = $('c-hook');
  accroche.textContent = type.note ?? '';
  accroche.hidden = !type.note;

  ligneGrille($('c-grid'), {
    'Distance': `${p.distanceUA} UA`,
    'Annee': p.anneeJ >= 365 ? `${(p.anneeJ / 365.25).toFixed(1)} ans` : `${Math.round(p.anneeJ)} j`,
    'Jour': p.jourH >= 48 ? `${Math.round(p.jourH / 24)} j` : `${p.jourH} h`,
    'Gravite': `${p.graviteG} g`,
    'Surface': `${p.temperatureC} °C`,
    'Diametre': `${(p.rayonKm * 2).toLocaleString('fr-FR')} km`,
    'Atmosphere': p.atmosphere,
    'Lunes': p.lunes.length ? p.lunes.map((l) => l.nom).join(', ') : '—',
  });

  const corps = $('c-corps');
  const gisements = p.gisements
    .map(
      (g) =>
        `<div class="r"><span>${g.nomUnique ?? ressource(g.ressource).nom}</span>` +
        `<span class="bar"><i style="width:${g.richesse}%"></i></span>` +
        `<span class="v">${g.richesse}</span></div>`,
    )
    .join('');
  corps.innerHTML =
    '<div class="sec">Ressources</div>' +
    `<div class="res-l">${gisements}</div>` +
    '<div class="sec">Colonisation</div>' +
    `<div class="colo"><b>${p.habitabilite}</b><span>${
      p.habitable
        ? 'Colonisation a ciel ouvert possible.'
        : p.dangers.length
          ? p.dangers.join(' · ')
          : 'Habitat sous dome uniquement.'
    }</span></div>` +
    (p.vie ? `<div class="sec">Vie indigene</div><div class="hook">${p.vie.nom} — ${p.vie.description}</div>` : '') +
    (p.artefact
      ? '<div class="sec">Anomalie</div><div class="hook">Signal artificiel enfoui : artefact probable. Un releve approfondi le confirmerait.</div>'
      : '');

  card.classList.add('open');
  vueSysteme.cadrer(orbite);
}

/* ------------------------------------------------------------ bascule de vue */

function entrerDansSysteme(id: number): void {
  mode = 'systeme';
  vueSysteme.charger(galaxie.systemes[id], galaxie.germe);
  poserEtiquettes();
  ($('b-retour') as HTMLButtonElement).hidden = false;
  ($('b-depart') as HTMLButtonElement).hidden = true;
  ($('b-neuf') as HTMLButtonElement).hidden = true;
  ($('b-portee') as HTMLButtonElement).hidden = true;
  $('prop').hidden = true;
  $('find').hidden = true;
  $('aide').textContent = 'Glisser pour parcourir le systeme · molette pour zoomer · cliquer un monde';
  $('aide').classList.remove('off');
  const s = galaxie.systemes[id];
  $('titre').textContent = s.nom;
  $('sous-titre').textContent =
    `${classeStellaire(s.classe).nom} ${s.classe} · ${s.planetes.length} mondes · releve d'exploitation`;
  fichePlanete(0);
}

function revenirALaCarte(): void {
  mode = 'galaxie';
  ($('b-retour') as HTMLButtonElement).hidden = true;
  ($('b-depart') as HTMLButtonElement).hidden = false;
  ($('b-neuf') as HTMLButtonElement).hidden = false;
  ($('b-portee') as HTMLButtonElement).hidden = false;
  $('find').hidden = false;
  $('aide').textContent = 'Glisser pour pivoter · molette pour zoomer · cliquer une etoile pour son releve';
  titreGalaxie();
  poserEtiquettes();
  ficheSysteme(systemeChoisi);
}

/* ------------------------------------------------------------------ camera */

const cibleGalaxie = new THREE.Vector3();
let theta = 0.7;
let phi = 1.15;
let distanceCamera = 260;
let distanceCible = 260;
let cibleTheta = theta;
let cibleP = phi;
const cibleLisse = new THREE.Vector3();

function placerGalaxie(): void {
  cibleLisse.lerp(cibleGalaxie, 0.1);
  cameraGalaxie.position.set(
    cibleLisse.x + distanceCamera * Math.sin(phi) * Math.sin(theta),
    cibleLisse.y + distanceCamera * Math.cos(phi),
    cibleLisse.z + distanceCamera * Math.sin(phi) * Math.cos(theta),
  );
  cameraGalaxie.lookAt(cibleLisse);
}

const el = renderer.domElement;
const pointeurs: Record<number, { x: number; y: number }> = {};
let dernier: { x: number; y: number } | null = null;
let pince = 0;
let bouge = 0;
const aide = $('aide');

el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  pointeurs[e.pointerId] = { x: e.clientX, y: e.clientY };
  dernier = { x: e.clientX, y: e.clientY };
  bouge = 0;
  aide.classList.add('off');
});
el.addEventListener('pointermove', (e) => {
  if (!pointeurs[e.pointerId] || !dernier) return;
  pointeurs[e.pointerId] = { x: e.clientX, y: e.clientY };
  const ids = Object.keys(pointeurs);
  if (ids.length >= 2) {
    const a = pointeurs[Number(ids[0])];
    const b = pointeurs[Number(ids[1])];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pince) {
      if (mode === 'galaxie') distanceCible = Math.max(20, Math.min(520, (distanceCible * pince) / d));
      else vueSysteme.pincer(pince / d);
    }
    pince = d;
    bouge = 99;
    return;
  }
  const dx = e.clientX - dernier.x;
  bouge += Math.abs(dx) + Math.abs(e.clientY - dernier.y);
  if (mode === 'galaxie') {
    cibleTheta -= dx * 0.005;
    cibleP = Math.max(0.18, Math.min(Math.PI - 0.18, cibleP - (e.clientY - dernier.y) * 0.004));
  } else {
    vueSysteme.glisser(dx);
  }
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
  if (mode === 'galaxie') distanceCible = Math.max(20, Math.min(520, distanceCible + e.deltaY * 0.09));
  else vueSysteme.zoomer(e.deltaY);
}, { passive: false });

const rayon = new THREE.Raycaster();
rayon.params.Points = { threshold: 2.6 };
const ndc = new THREE.Vector2();

function viser(px: number, py: number): void {
  ndc.x = (px / innerWidth) * 2 - 1;
  ndc.y = -(py / innerHeight) * 2 + 1;
  if (mode === 'galaxie') {
    rayon.setFromCamera(ndc, cameraGalaxie);
    const touches = rayon.intersectObject(etoiles, false);
    ficheSysteme(touches.length && touches[0].index !== undefined ? touches[0].index : -1);
  } else {
    rayon.setFromCamera(ndc, vueSysteme.camera);
    const orbite = vueSysteme.viser(rayon);
    if (orbite >= 0) fichePlanete(orbite);
  }
}

/* -------------------------------------------------------------- etiquettes */

let etiquettes: { el: HTMLElement; systeme?: Systeme; orbite?: number }[] = [];

function poserEtiquettes(): void {
  for (const e of etiquettes) e.el.remove();
  etiquettes = [];
  if (mode === 'galaxie') {
    etiquettes = galaxie.systemes
      .filter((s) => s.joueurDepart !== null)
      .map((s) => {
        const d = document.createElement('div');
        d.className = 'lbl home';
        d.innerHTML = `${s.nom}<em>depart ${(s.joueurDepart ?? 0) + 1}</em>`;
        document.body.appendChild(d);
        return { el: d, systeme: s };
      });
  } else if (vueSysteme.systeme) {
    etiquettes = vueSysteme.systeme.planetes.map((p) => {
      const d = document.createElement('div');
      d.className = 'lbl';
      d.innerHTML = `${p.nom}<em>${p.distanceUA} UA</em>`;
      document.body.appendChild(d);
      return { el: d, orbite: p.orbite };
    });
  }
}

/* -------------------------------------------------------------- interface */

function paliers(): void {
  const hote = $('paliers');
  hote.innerHTML = '';
  for (let p = 0; p <= PALIER_MAX; p++) {
    const b = document.createElement('button');
    b.textContent = String(p);
    b.className = p === palier ? 'on' : '';
    b.onclick = () => {
      palier = p;
      construireCarte(galaxie);
      majAccessibilite();
      paliers();
      if (systemeChoisi >= 0 && mode === 'galaxie') ficheSysteme(systemeChoisi);
    };
    hote.appendChild(b);
  }
}

function titreGalaxie(): void {
  $('titre').textContent = galaxie.germe;
  $('sous-titre').textContent =
    `${galaxie.systemes.length} systemes · ` +
    `${galaxie.systemes.reduce((n, s) => n + s.planetes.length, 0)} mondes · ` +
    `${galaxie.routes.length} routes · ${galaxie.trousDeVer.length} trous de ver`;
}

function charger(germe: string): void {
  galaxie = genererGalaxie({ germe, systemes: CONFIG.carte.tailles.standard, joueurs: 6 });
  mode = 'galaxie';
  systemeChoisi = -1;
  card.classList.remove('open');
  document.body.classList.remove('fiche-ouverte');
  construireCarte(galaxie);
  majAccessibilite();
  poserEtiquettes();
  titreGalaxie();
}

$('b-neuf').onclick = () => charger(germeAleatoire());
$('b-vue').onclick = () => {
  if (mode === 'galaxie') {
    cibleGalaxie.set(0, 0, 0);
    distanceCible = 260;
    ficheSysteme(-1);
  } else {
    vueSysteme.vueEnsemble();
    fichePlanete(-1);
  }
};
$('b-depart').onclick = () => {
  const s = galaxie.systemes.find((x) => x.joueurDepart === departJoueur);
  if (s) ficheSysteme(s.id);
};
$('b-portee').onclick = () => {
  const panneau = $('prop');
  panneau.hidden = !panneau.hidden;
  $('b-portee').classList.toggle('on', !panneau.hidden);
};
$('b-entrer').onclick = () => { if (systemeChoisi >= 0) entrerDansSysteme(systemeChoisi); };
$('b-retour').onclick = revenirALaCarte;
$('close').onclick = () => (mode === 'galaxie' ? ficheSysteme(-1) : fichePlanete(-1));

const champ = $('q') as HTMLInputElement;
const hits = $('hits');
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
      b.onclick = () => { ficheSysteme(s.id); hits.innerHTML = ''; champ.value = ''; };
      hits.appendChild(b);
    });
};

/* ------------------------------------------------------------------ boucle */

const v = new THREE.Vector3();
function image(): void {
  requestAnimationFrame(image);

  if (mode === 'galaxie') {
    theta += (cibleTheta - theta) * 0.09;
    phi += (cibleP - phi) * 0.09;
    distanceCamera += (distanceCible - distanceCamera) * 0.09;
    placerGalaxie();
    for (const e of etiquettes) {
      if (!e.systeme) continue;
      v.set(...e.systeme.pos).project(cameraGalaxie);
      const sx = (v.x * 0.5 + 0.5) * innerWidth;
      const sy = (-v.y * 0.5 + 0.5) * innerHeight;
      e.el.style.transform = `translate(-50%,-100%) translate(${sx}px,${sy - 10}px)`;
      e.el.classList.toggle('off', v.z > 1);
    }
    renderer.render(sceneGalaxie, cameraGalaxie);
  } else {
    vueSysteme.animer();
    for (const e of etiquettes) {
      if (e.orbite === undefined) continue;
      const p = vueSysteme.projeter(e.orbite);
      if (!p) continue;
      e.el.style.transform = `translate(-50%,-100%) translate(${p.x}px,${p.y}px)`;
      e.el.classList.toggle('off', !p.visible || (mondeChoisi >= 0 && mondeChoisi !== e.orbite));
    }
    renderer.render(vueSysteme.scene, vueSysteme.camera);
  }
}

addEventListener('resize', () => {
  cameraGalaxie.aspect = innerWidth / innerHeight;
  cameraGalaxie.updateProjectionMatrix();
  vueSysteme.camera.aspect = innerWidth / innerHeight;
  vueSysteme.camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

paliers();
charger(germeAleatoire());
image();

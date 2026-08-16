/**
 * Generation de la galaxie.
 *
 * Ordre des operations : on pose les etoiles, on y jette les nebuleuses, on
 * tisse le reseau de sauts en contournant ces nebuleuses, on perce quelques
 * trous de ver, puis on peuple chaque systeme. Les positions de depart sont
 * choisies en dernier, une fois la topologie connue, pour qu'aucun joueur ne
 * commence enclave.
 */

import { CLASSES, CONFIG, classeStellaire, typePlanete } from './data';
import { Nommeur } from './names';
import { genererPlanetes } from './planets';
import { Rng } from './rng';
import type { Galaxie, Nebuleuse, OptionsGeneration, Route, Systeme, TrouDeVer } from './types';

const C = CONFIG.carte;

type Point = [number, number, number];

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Pose les etoiles dans un disque aplati, avec une distance minimale entre
 * voisines : sans elle, le tirage uniforme produit des amas illisibles.
 */
function poserEtoiles(rng: Rng, nombre: number, rayon: number, epaisseur: number): Point[] {
  const points: Point[] = [];
  const cellule = C.distance_min_al;
  const grille = new Map<string, Point[]>();
  const cle = (p: Point) =>
    `${Math.floor(p[0] / cellule)},${Math.floor(p[1] / cellule)},${Math.floor(p[2] / cellule)}`;

  const tropProche = (p: Point, dmin: number) => {
    const cx = Math.floor(p[0] / cellule);
    const cy = Math.floor(p[1] / cellule);
    const cz = Math.floor(p[2] / cellule);
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let z = cz - 1; z <= cz + 1; z++) {
          const seau = grille.get(`${x},${y},${z}`);
          if (!seau) continue;
          for (const q of seau) if (distance(p, q) < dmin) return true;
        }
    return false;
  };

  let dmin = C.distance_min_al;
  while (points.length < nombre) {
    let pose = false;
    for (let essai = 0; essai < 120; essai++) {
      const u = rng.next();
      const r = rayon * Math.pow(u, 0.5);
      const theta = rng.next() * Math.PI * 2;
      const p: Point = [
        r * Math.cos(theta),
        Math.max(-epaisseur, Math.min(epaisseur, rng.gaussian() * epaisseur * 0.42)),
        r * Math.sin(theta),
      ];
      if (tropProche(p, dmin)) continue;
      points.push(p);
      const k = cle(p);
      if (!grille.has(k)) grille.set(k, []);
      grille.get(k)!.push(p);
      pose = true;
      break;
    }
    // Densite saturee : on relache la contrainte plutot que de boucler sans fin.
    if (!pose) dmin *= 0.92;
  }
  return points;
}

/** Un segment traverse-t-il la sphere de la nebuleuse ? */
function traverse(a: Point, b: Point, centre: Point, rayon: number): boolean {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const fx = a[0] - centre[0], fy = a[1] - centre[1], fz = a[2] - centre[2];
  const A = dx * dx + dy * dy + dz * dz;
  const B = 2 * (fx * dx + fy * dy + fz * dz);
  const D = fx * fx + fy * fy + fz * fz - rayon * rayon;
  const disc = B * B - 4 * A * D;
  if (disc < 0) return false;
  const racine = Math.sqrt(disc);
  const t1 = (-B - racine) / (2 * A);
  const t2 = (-B + racine) / (2 * A);
  return (t1 > 0 && t1 < 1) || (t2 > 0 && t2 < 1) || (t1 < 0 && t2 > 1);
}

function composantes(nombre: number, voisins: number[][]): number[] {
  const marque = new Array(nombre).fill(-1);
  let id = 0;
  for (let depart = 0; depart < nombre; depart++) {
    if (marque[depart] >= 0) continue;
    const file = [depart];
    marque[depart] = id;
    while (file.length) {
      const c = file.pop()!;
      for (const v of voisins[c]) if (marque[v] < 0) { marque[v] = id; file.push(v); }
    }
    id++;
  }
  return marque;
}

function tisserRoutes(
  positions: Point[],
  nebuleuses: Nebuleuse[],
  rng: Rng,
): { routes: Route[]; voisins: number[][]; voisinsBase: number[][] } {
  const n = positions.length;
  const voisins: number[][] = Array.from({ length: n }, () => []);
  // Adjacence limitee a la portee de saut initiale : c'est elle qui sert a placer
  // les joueurs, pour que personne ne commence dans une poche inaccessible.
  const voisinsBase: number[][] = Array.from({ length: n }, () => []);
  const routes: Route[] = [];
  const vues = new Set<string>();

  // Une nebuleuse interdit la traversee, pas l'acces : une route dont une
  // extremite est a l'interieur reste praticable, sinon les systemes noyes dans
  // le nuage seraient definitivement inaccessibles.
  const bloque = (a: Point, b: Point) =>
    nebuleuses.some((neb) => {
      const dedansA = distance(a, neb.centre) < neb.rayonAl;
      const dedansB = distance(b, neb.centre) < neb.rayonAl;
      if (dedansA || dedansB) return false;
      return traverse(a, b, neb.centre, neb.rayonAl);
    });

  const ajouter = (i: number, j: number, longue: boolean) => {
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (vues.has(k)) return;
    vues.add(k);
    routes.push({ a: i, b: j, d: Number(distance(positions[i], positions[j]).toFixed(2)), longue });
    voisins[i].push(j);
    voisins[j].push(i);
    if (!longue) {
      voisinsBase[i].push(j);
      voisinsBase[j].push(i);
    }
  };

  // 1. Chaque etoile se relie a ses plus proches voisines dans la portee de saut.
  for (let i = 0; i < n; i++) {
    const proches: { j: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = distance(positions[i], positions[j]);
      if (d <= C.portee_saut_al) proches.push({ j, d });
    }
    proches.sort((x, y) => x.d - y.d);
    const combien = rng.int(3, 6);
    for (const { j } of proches.slice(0, combien)) {
      if (!bloque(positions[i], positions[j])) ajouter(i, j, false);
    }
  }

  // 2. Routes longues : elles existent des la generation mais depassent la portee
  //    de saut initiale. Elles restent donc visibles et inutilisables jusqu'a ce que
  //    la propulsion les ouvre — c'est ce qui fait que progresser en propulsion
  //    raccourcit reellement les trajets au lieu de les accelerer un peu.
  for (let i = 0; i < n; i++) {
    const lointains: { j: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j || voisins[i].includes(j)) continue;
      const d = distance(positions[i], positions[j]);
      if (d > C.portee_saut_al && d <= C.portee_saut_max_al) lointains.push({ j, d });
    }
    lointains.sort((x, y) => x.d - y.d);
    for (const { j } of lointains.slice(0, rng.int(1, 3))) {
      if (!bloque(positions[i], positions[j])) ajouter(i, j, true);
    }
  }

  // 3. Recollage des ilots : routes longues, hors de portee au depart, que seule
  //    la propulsion ouvrira. Une region isolee reste donc un objectif de partie.
  for (let passe = 0; passe < 40; passe++) {
    const marque = composantes(n, voisins);
    const nbComposantes = Math.max(...marque) + 1;
    if (nbComposantes <= 1) break;

    const tailles = new Array(nbComposantes).fill(0);
    for (const m of marque) tailles[m]++;
    const principale = tailles.indexOf(Math.max(...tailles));

    for (let comp = 0; comp < nbComposantes; comp++) {
      if (comp === principale) continue;
      let meilleur: { i: number; j: number; d: number } | null = null;
      for (let i = 0; i < n; i++) {
        if (marque[i] !== comp) continue;
        for (let j = 0; j < n; j++) {
          if (marque[j] !== principale) continue;
          const d = distance(positions[i], positions[j]);
          if ((!meilleur || d < meilleur.d) && !bloque(positions[i], positions[j])) {
            meilleur = { i, j, d };
          }
        }
      }
      if (meilleur) ajouter(meilleur.i, meilleur.j, meilleur.d > C.portee_saut_al);
    }
  }

  return { routes, voisins, voisinsBase };
}

function percerTrousDeVer(rng: Rng, positions: Point[]): TrouDeVer[] {
  const trous: TrouDeVer[] = [];
  const combien = rng.int(C.trous_de_ver[0], C.trous_de_ver[1]);
  const pris = new Set<number>();
  for (let essai = 0; essai < 400 && trous.length < combien; essai++) {
    const a = rng.int(0, positions.length - 1);
    const b = rng.int(0, positions.length - 1);
    if (a === b || pris.has(a) || pris.has(b)) continue;
    // Un trou de ver n'a d'interet que s'il economise un long trajet.
    if (distance(positions[a], positions[b]) < C.rayon_al * 0.75) continue;
    pris.add(a);
    pris.add(b);
    trous.push({ a, b, naturel: true, stable: false });
  }
  return trous;
}

/**
 * Garantit un monde habitable dans un systeme de depart : on requalifie le
 * meilleur candidat de la zone temperee plutot que de retirer la carte.
 */
function forcerMondeHabitable(rng: Rng, systeme: Systeme): void {
  if (systeme.planetes.some((p) => p.habitable)) return;
  const temperees = systeme.planetes.filter((p) => p.zone === 'temperee');
  const cible = temperees.length
    ? temperees.reduce((a, b) => (a.habitabilite >= b.habitabilite ? a : b))
    : systeme.planetes.reduce((a, b) => (a.habitabilite >= b.habitabilite ? a : b));
  const modele = typePlanete(rng.chance(0.7) ? 'tempere' : 'ocean');
  cible.type = modele.id;
  cible.zone = 'temperee';
  cible.atmosphere = modele.atmosphere;
  cible.dangers = [...modele.dangers];
  cible.habitabilite = Math.round(rng.range(74, 94));
  cible.habitable = true;
  cible.emplacements = Math.max(cible.emplacements, 10);
  cible.gisements = [
    { ressource: 'eau', richesse: Math.round(rng.range(55, 90)), acces: 1 },
    { ressource: 'biomasse', richesse: Math.round(rng.range(45, 85)), acces: 1 },
    { ressource: 'silice', richesse: Math.round(rng.range(25, 60)), acces: 2 },
    { ressource: 'fer_nickel', richesse: Math.round(rng.range(20, 55)), acces: 2 },
  ];
}

/** Positions de depart : habitables, dans la composante principale, et le plus eloignees possible. */
function choisirDeparts(
  systemes: Systeme[],
  voisins: number[][],
  joueurs: number,
  rng: Rng,
): number[] {
  const marque = composantes(systemes.length, voisins);
  const tailles: number[] = [];
  for (const m of marque) tailles[m] = (tailles[m] ?? 0) + 1;
  const principale = tailles.indexOf(Math.max(...tailles));

  const eligibles = systemes
    .map((_, i) => i)
    .filter((i) => marque[i] === principale && systemes[i].planetes.length >= 3);

  const avecMonde = eligibles.filter((i) => systemes[i].habitables > 0);
  const bassin = avecMonde.length >= joueurs ? avecMonde : eligibles;

  // Echantillonnage du point le plus eloigne : maximise la distance entre empires.
  const choisis: number[] = [rng.pick(bassin)];
  while (choisis.length < joueurs && choisis.length < bassin.length) {
    let meilleur = -1;
    let meilleureD = -1;
    for (const i of bassin) {
      if (choisis.includes(i)) continue;
      const d = Math.min(...choisis.map((j) => distance(systemes[i].pos, systemes[j].pos)));
      if (d > meilleureD) { meilleureD = d; meilleur = i; }
    }
    if (meilleur < 0) break;
    choisis.push(meilleur);
  }
  return choisis;
}

export function genererGalaxie(options: OptionsGeneration): Galaxie {
  const nombre = options.systemes ?? C.tailles[C.defaut as keyof typeof C.tailles];
  const joueurs = options.joueurs ?? 1;
  const rng = new Rng(options.germe);
  const nommeur = new Nommeur(rng.derive('noms'));

  const positions = poserEtoiles(rng, nombre, C.rayon_al, C.epaisseur_al);

  // Nebuleuses : elles ne se contentent pas de decorer, elles coupent les routes.
  const nebuleuses: Nebuleuse[] = [];
  const combienNeb = rng.int(C.nebuleuses[0], C.nebuleuses[1]);
  for (let i = 0; i < combienNeb; i++) {
    const r = C.rayon_al * rng.range(0.15, 0.8);
    const theta = rng.next() * Math.PI * 2;
    nebuleuses.push({
      id: i,
      nom: nommeur.propre(),
      centre: [r * Math.cos(theta), rng.range(-6, 6), r * Math.sin(theta)],
      rayonAl: rng.range(C.rayon_nebuleuse_al[0], C.rayon_nebuleuse_al[1]),
      effet: 'aucune route ne traverse la nebuleuse : elle oblige a contourner',
    });
  }

  const { routes, voisins, voisinsBase } = tisserRoutes(positions, nebuleuses, rng);
  const trousDeVer = percerTrousDeVer(rng, positions);

  const systemes: Systeme[] = positions.map((pos, i) => {
    const classe = rng.weighted(CLASSES, (c) => c.poids);
    // Flux derive : les planetes d'un systeme peuvent etre regenerees a l'identique
    // a tout moment, sans avoir a rejouer toute la galaxie.
    const planetes = genererPlanetes(rng.derive(`systeme:${i}`), classe, nommeur);
    const dansNebuleuse = nebuleuses.find(
      (neb) => distance(pos, neb.centre) < neb.rayonAl,
    );
    return {
      id: i,
      nom: rng.chance(0.42) ? nommeur.propre() : nommeur.catalogue(),
      pos,
      classe: classe.id,
      luminosite: classe.luminosite,
      planetes,
      voisins: voisins[i],
      nebuleuse: dansNebuleuse ? dansNebuleuse.id : null,
      joueurDepart: null,
      habitables: planetes.filter((p) => p.habitable).length,
    };
  });

  const departs = choisirDeparts(systemes, voisinsBase, joueurs, rng.derive('departs'));
  departs.forEach((idSysteme, joueur) => {
    const systeme = systemes[idSysteme];
    forcerMondeHabitable(rng.derive(`depart:${joueur}`), systeme);
    systeme.habitables = systeme.planetes.filter((p) => p.habitable).length;
    systeme.joueurDepart = joueur;
  });

  return {
    germe: options.germe,
    rayonAl: C.rayon_al,
    porteeSautAl: C.portee_saut_al,
    systemes,
    routes,
    nebuleuses,
    trousDeVer,
  };
}

/** Classe stellaire complete d'un systeme, pour l'affichage. */
export function classeDe(systeme: Systeme) {
  return classeStellaire(systeme.classe);
}

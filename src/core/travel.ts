/**
 * Modele de deplacement.
 *
 *   temps_de_saut = (distance / (vitesse_base * vitesse_de_classe)) * facteur + amorcage
 *
 * La propulsion agit sur deux leviers a la fois : elle reduit le facteur, et
 * elle augmente la portee de saut — donc elle supprime des sauts entiers, et
 * avec eux leurs amorcages. C'est la branche qui deplie la carte : au palier 0
 * la moitie de la galaxie est hors d'atteinte utile, au palier 5 elle ne l'est
 * plus.
 */

import { CONFIG } from './data';
import type { ClasseVaisseau, Galaxie } from './types';

const D = CONFIG.deplacement;

export const PALIER_MAX = D.facteur_propulsion.length - 1;

function palierValide(palier: number): number {
  return Math.max(0, Math.min(PALIER_MAX, Math.floor(palier)));
}

/** Portee de saut en annees-lumiere au palier de propulsion donne. */
export function porteeDe(palier: number): number {
  return D.portee_par_palier_al[palierValide(palier)];
}

/** Duree d'un saut, en secondes de temps de jeu a la vitesse x1. */
export function tempsDeSaut(
  distanceAl: number,
  classe: ClasseVaisseau,
  palier: number,
): number {
  const vitesse = D.vitesse_base_al_par_s * D.classes[classe];
  return (distanceAl / vitesse) * D.facteur_propulsion[palierValide(palier)] + D.amorcage_s;
}

export interface Trajet {
  chemin: number[];
  /** Duree totale en secondes de jeu. */
  temps: number;
  sauts: number;
  distanceAl: number;
}

export interface Accessibilite {
  /** Duree du trajet le plus rapide vers chaque systeme, Infinity si hors d'atteinte. */
  temps: number[];
  sauts: number[];
  distances: number[];
  precedent: number[];
}

/**
 * Temps de trajet depuis un systeme vers tous les autres.
 *
 * Les routes plus longues que la portee courante sont simplement absentes du
 * graphe : un joueur mal equipe ne voit pas un trajet plus lent, il voit un mur.
 */
export function accessibilite(
  galaxie: Galaxie,
  depart: number,
  classe: ClasseVaisseau = 'eclaireur',
  palier = 0,
  trousDeVerOuverts = true,
): Accessibilite {
  const portee = porteeDe(palier);
  const n = galaxie.systemes.length;
  const arcs: { vers: number; d: number; temps: number }[][] = Array.from({ length: n }, () => []);

  for (const route of galaxie.routes) {
    if (route.d > portee) continue;
    const t = tempsDeSaut(route.d, classe, palier);
    arcs[route.a].push({ vers: route.b, d: route.d, temps: t });
    arcs[route.b].push({ vers: route.a, d: route.d, temps: t });
  }
  if (trousDeVerOuverts) {
    for (const trou of galaxie.trousDeVer) {
      if (!trou.stable) continue;
      // Un trou de ver coute une transition, pas une distance.
      const t = D.amorcage_s * 2;
      arcs[trou.a].push({ vers: trou.b, d: 0, temps: t });
      arcs[trou.b].push({ vers: trou.a, d: 0, temps: t });
    }
  }

  const temps = new Array(n).fill(Infinity);
  const distances = new Array(n).fill(0);
  const sauts = new Array(n).fill(0);
  const precedent = new Array(n).fill(-1);
  const vus = new Array(n).fill(false);
  temps[depart] = 0;

  for (;;) {
    let courant = -1;
    let meilleur = Infinity;
    for (let i = 0; i < n; i++) if (!vus[i] && temps[i] < meilleur) { meilleur = temps[i]; courant = i; }
    if (courant < 0) break;
    vus[courant] = true;
    for (const arc of arcs[courant]) {
      const candidat = temps[courant] + arc.temps;
      if (candidat < temps[arc.vers]) {
        temps[arc.vers] = candidat;
        distances[arc.vers] = distances[courant] + arc.d;
        sauts[arc.vers] = sauts[courant] + 1;
        precedent[arc.vers] = courant;
      }
    }
  }
  return { temps, sauts, distances, precedent };
}

/** Trajet le plus rapide entre deux systemes, ou null s'il n'en existe aucun. */
export function trajetLePlusRapide(
  galaxie: Galaxie,
  depart: number,
  arrivee: number,
  classe: ClasseVaisseau = 'eclaireur',
  palier = 0,
): Trajet | null {
  const acces = accessibilite(galaxie, depart, classe, palier);
  if (!isFinite(acces.temps[arrivee])) return null;
  const chemin: number[] = [];
  for (let i = arrivee; i >= 0; i = acces.precedent[i]) chemin.push(i);
  chemin.reverse();
  return {
    chemin,
    temps: acces.temps[arrivee],
    sauts: acces.sauts[arrivee],
    distanceAl: Number(acces.distances[arrivee].toFixed(1)),
  };
}

/** Systemes atteignables en moins de `budget` secondes depuis un systeme. */
export function porteeUtile(
  galaxie: Galaxie,
  depart: number,
  budget: number,
  classe: ClasseVaisseau = 'eclaireur',
  palier = 0,
): number[] {
  const { temps } = accessibilite(galaxie, depart, classe, palier);
  const atteignables: number[] = [];
  for (let i = 0; i < temps.length; i++) {
    if (i !== depart && temps[i] <= budget) atteignables.push(i);
  }
  return atteignables;
}

/** Duree en clair : « 41 min 20 s ». */
export function formaterDuree(secondes: number): string {
  const s = Math.round(secondes);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m > 0) return `${m} min ${String(r).padStart(2, '0')} s`;
  return `${r} s`;
}

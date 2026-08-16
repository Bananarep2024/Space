/**
 * Types du noyau de simulation.
 *
 * Aucune de ces structures ne connait Three.js, le DOM ou le navigateur : le
 * noyau doit pouvoir tourner dans une console, dans un test, sur un serveur, et
 * plus tard etre transpose en C# pour Unity sans rien perdre.
 */

export type NiveauReleve = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export type ClasseVaisseau = 'eclaireur' | 'croiseur' | 'transport' | 'colonisateur';

export type Zone = 'chaude' | 'temperee' | 'froide';

/** Un gisement exploitable sur une planete. */
export interface Gisement {
  /** Identifiant de la ressource dans data/resources.json. */
  ressource: string;
  /** Richesse 1-100 : debit d'extraction relatif. */
  richesse: number;
  /** Difficulte d'acces 1-5 : cout d'infrastructure pour l'exploiter. */
  acces: number;
  /** Nom propre du xenomateriau, quand il s'agit d'une ressource unique. */
  nomUnique?: string;
}

/** Forme de vie indigene reperee sur une planete. */
export interface FormeDeVie {
  nom: string;
  /** 0 = microbien, 1 = flore, 2 = faune, 3 = faune complexe, 4 = intelligence. */
  palier: number;
  /** Effet de jeu dominant. */
  effet: 'contrainte' | 'benefice' | 'les deux';
  description: string;
}

export interface Lune {
  nom: string;
  rayonKm: number;
  gisements: Gisement[];
}

export interface Planete {
  id: string;
  nom: string;
  /** Rang orbital, 0 = la plus interne. */
  orbite: number;
  /** Demi-grand axe en unites astronomiques. */
  distanceUA: number;
  zone: Zone;
  type: string;
  rayonKm: number;
  graviteG: number;
  /** Duree du jour en heures. */
  jourH: number;
  /** Duree de l'annee en jours terrestres. */
  anneeJ: number;
  temperatureC: number;
  atmosphere: string;
  /** Score de colonisation 0-100. */
  habitabilite: number;
  habitable: boolean;
  gisements: Gisement[];
  lunes: Lune[];
  anneaux: boolean;
  dangers: string[];
  vie: FormeDeVie | null;
  /** Artefact enfoui, revele au niveau de releve L4. */
  artefact: boolean;
  /** Emplacements de batiments disponibles. */
  emplacements: number;
}

export interface Systeme {
  id: number;
  nom: string;
  /** Position en annees-lumiere dans le repere galactique. */
  pos: [number, number, number];
  classe: string;
  luminosite: number;
  planetes: Planete[];
  /** Indices des systemes joignables en un saut. */
  voisins: number[];
  /** Vrai si le systeme est plonge dans une nebuleuse. */
  nebuleuse: number | null;
  /** Position de depart attribuee a un joueur, ou null. */
  joueurDepart: number | null;
  /** Nombre de mondes de score >= seuil, precalcule pour l'equilibrage. */
  habitables: number;
}

export interface Route {
  a: number;
  b: number;
  /** Distance en annees-lumiere. */
  d: number;
  /** Route au-dela de la portee de saut de depart : ouverte par la propulsion. */
  longue: boolean;
}

export interface TrouDeVer {
  a: number;
  b: number;
  /** Naturel a la generation, ou creuse par un joueur en cours de partie. */
  naturel: boolean;
  /** Un trou de ver naturel doit d'abord etre detecte pour etre emprunte. */
  stable: boolean;
}

export interface Nebuleuse {
  id: number;
  nom: string;
  centre: [number, number, number];
  rayonAl: number;
  /** Aucune route ne traverse une nebuleuse : elle oblige a contourner. */
  effet: string;
}

export interface Galaxie {
  germe: string;
  rayonAl: number;
  porteeSautAl: number;
  systemes: Systeme[];
  routes: Route[];
  nebuleuses: Nebuleuse[];
  trousDeVer: TrouDeVer[];
}

export interface OptionsGeneration {
  germe: string;
  /** Nombre de systemes. */
  systemes?: number;
  /** Nombre de positions de depart a reserver. */
  joueurs?: number;
}

/**
 * Chargement et typage des donnees de jeu.
 *
 * Les fichiers de data/ sont la source de verite de l'equilibrage : on peut
 * ajouter une ressource, changer un cout ou renommer la monnaie sans toucher
 * une ligne de code. Ces memes fichiers seront relus tels quels par Unity.
 */

import ressourcesJson from '../../data/resources.json';
import classesJson from '../../data/star-classes.json';
import typesJson from '../../data/planet-types.json';
import configJson from '../../data/config.json';
import type { Zone } from './types';

export interface Ressource {
  id: string;
  nom: string;
  famille: string;
  etat: 'brut' | 'raffine' | 'flux';
  abondance?: number;
  difficulte?: number;
  transport: 'local' | 'standard' | 'dense' | 'immateriel';
  usages: string[];
  intrants?: string[];
  note?: string;
  monnaie?: boolean;
  perissable?: boolean;
  unique_par_monde?: boolean;
}

export interface ClasseStellaire {
  id: string;
  nom: string;
  couleur: string;
  taille: number;
  poids: number;
  luminosite: number;
  planetes: [number, number];
  kaerium?: number;
  habitabilite?: number;
  note?: string;
}

export interface TypePlanete {
  id: string;
  nom: string;
  categorie: 'tellurique' | 'geante' | 'glace';
  couleur: string;
  zones: Record<Zone, number>;
  rayon_km: [number, number];
  habitabilite: number;
  atmosphere: string;
  ressources: Record<string, number>;
  dangers: string[];
  vie: number;
  habitable?: boolean;
  rarete?: number;
  note?: string;
  /** Indications de rendu : palette et trait dominant de la surface. */
  rendu: {
    palette: string[];
    trait: 'fractures' | 'crateres' | 'canyon' | 'voile' | 'veines' | 'continents' | 'oceans' | 'banquise' | 'bandes';
    /** Geantes : familles de teintes possibles, en degres. */
    teintes?: [number, number][];
    /** Geantes : poids des motifs atmospheriques. */
    motifs?: Record<string, number>;
  };
}

export const RESSOURCES = ressourcesJson.ressources as unknown as Ressource[];
export const FAMILLES = ressourcesJson.familles as Record<string, string>;
export const CLASSES = classesJson.classes as unknown as ClasseStellaire[];
export const TYPES_PLANETES = typesJson.types as unknown as TypePlanete[];
export const CONFIG = configJson;

const parId = new Map(RESSOURCES.map((r) => [r.id, r]));
const typeParId = new Map(TYPES_PLANETES.map((t) => [t.id, t]));
const classeParId = new Map(CLASSES.map((c) => [c.id, c]));

export function ressource(id: string): Ressource {
  const r = parId.get(id);
  if (!r) throw new Error(`Ressource inconnue : ${id}`);
  return r;
}

export function typePlanete(id: string): TypePlanete {
  const t = typeParId.get(id);
  if (!t) throw new Error(`Type de planete inconnu : ${id}`);
  return t;
}

export function classeStellaire(id: string): ClasseStellaire {
  const c = classeParId.get(id);
  if (!c) throw new Error(`Classe stellaire inconnue : ${id}`);
  return c;
}

/** Identifiant de la ressource servant de monnaie, declaree dans les donnees. */
export const MONNAIE = RESSOURCES.find((r) => r.monnaie)?.id ?? 'kaerium';

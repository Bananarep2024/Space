/**
 * Point d'entree du noyau de simulation.
 *
 * Regle d'architecture : rien sous src/core/ n'importe Three.js ni le DOM. Le
 * noyau se teste dans une console, tournera sur un serveur autoritatif en
 * multijoueur, et se transpose en C# pour Unity sans emporter la vue avec lui.
 */

export { Rng, germeAleatoire } from './rng';
export { Nommeur, nomXenomateriau } from './names';
export { genererGalaxie, classeDe } from './galaxy';
export { genererPlanetes } from './planets';
export {
  tempsDeSaut,
  trajetLePlusRapide,
  accessibilite,
  porteeDe,
  porteeUtile,
  formaterDuree,
  PALIER_MAX,
  type Trajet,
  type Accessibilite,
} from './travel';
export {
  RESSOURCES,
  FAMILLES,
  CLASSES,
  TYPES_PLANETES,
  CONFIG,
  MONNAIE,
  ressource,
  typePlanete,
  classeStellaire,
  type Ressource,
  type ClasseStellaire,
  type TypePlanete,
} from './data';
export type * from './types';

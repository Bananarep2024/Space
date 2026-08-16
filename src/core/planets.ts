/**
 * Generation des planetes d'un systeme.
 *
 * Chaque systeme contient entre 1 et 12 mondes, poses sur des orbites
 * croissantes. La position orbitale determine la zone thermique, la zone
 * determine les types possibles, le type determine les ressources. Rien n'est
 * tire au hasard sans contrainte physique : c'est ce qui rend un releve
 * lisible pour le joueur, qui peut anticiper avant meme d'avoir explore.
 */

import { CONFIG, TYPES_PLANETES, ressource, type ClasseStellaire, type TypePlanete } from './data';
import { nomXenomateriau, type Nommeur } from './names';
import type { Rng } from './rng';
import type { FormeDeVie, Gisement, Lune, Planete, Zone } from './types';

const [PLANETES_MIN, PLANETES_MAX] = CONFIG.carte.planetes_par_systeme as [number, number];
const SEUIL_HABITABLE = CONFIG.habitabilite.seuil_habitable;

/** Nombre de mondes : pic autour de 4-5, longue traine jusqu'a 12. */
function nombreDePlanetes(rng: Rng, classe: ClasseStellaire): number {
  const min = Math.max(PLANETES_MIN, classe.planetes[0]);
  const max = Math.min(PLANETES_MAX, classe.planetes[1]);
  const choix: number[] = [];
  for (let n = min; n <= max; n++) choix.push(n);
  return rng.weighted(choix, (n) => Math.exp(-((n - 4.5) ** 2) / 18));
}

function zoneDe(distanceUA: number, luminosite: number): Zone {
  const interne = 0.95 * Math.sqrt(luminosite);
  const externe = 1.7 * Math.sqrt(luminosite);
  if (distanceUA < interne * 0.92) return 'chaude';
  if (distanceUA <= externe * 1.15) return 'temperee';
  return 'froide';
}

function choisirType(rng: Rng, zone: Zone, dejaHabitable: boolean): TypePlanete {
  return rng.weighted(TYPES_PLANETES, (t) => {
    let poids = t.zones[zone] ?? 0;
    if (poids <= 0) return 0;
    // Les mondes accueillants sont rares : leur poids brut est fortement reduit,
    // et un second monde habitable dans le meme systeme l'est encore plus.
    if (t.habitable) {
      poids *= t.rarete ?? 0.12;
      if (dejaHabitable) poids *= CONFIG.habitabilite.chance_seconde_habitable;
    }
    return poids;
  });
}

function graviteDe(rng: Rng, type: TypePlanete, rayonKm: number): number {
  if (type.categorie === 'geante') return Number(rng.range(1.4, 2.9).toFixed(2));
  const densite = type.id === 'metallique' ? 1.35 : type.categorie === 'glace' ? 0.6 : 1.0;
  return Number(Math.max(0.05, (rayonKm / 6371) * densite * rng.range(0.9, 1.1)).toFixed(2));
}

function temperatureDe(distanceUA: number, luminosite: number, type: TypePlanete): number {
  const equilibre = 278 * Math.pow(luminosite, 0.25) / Math.sqrt(Math.max(0.02, distanceUA));
  const serre =
    type.id === 'serre' ? 420 : type.id === 'volcanique' ? 260 :
    type.id === 'tempere' || type.id === 'jungle' || type.id === 'ocean' ? 34 :
    type.categorie === 'geante' ? -20 : 8;
  return Math.round(equilibre + serre - 273);
}

/** Tire les gisements a partir des affinites du type de monde. */
function gisementsDe(
  rng: Rng,
  type: TypePlanete,
  classe: ClasseStellaire,
  zone: Zone,
): Gisement[] {
  const candidats = Object.entries(type.ressources);
  const combien = Math.min(candidats.length, rng.int(2, 5));
  const restants = [...candidats];
  const gisements: Gisement[] = [];

  // Les ressources strategiques restent rares meme sur les mondes qui s'y pretent :
  // sans ce frein, un empire trouve des terres rares partout et la carte perd son relief.
  const frein = (id: string) => (ressource(id).famille === 'strategiques' ? 0.45 : 1);

  for (let i = 0; i < combien; i++) {
    const choisi = rng.weighted(restants, ([id, poids]) => poids * frein(id));
    restants.splice(restants.indexOf(choisi), 1);
    const [id, poids] = choisi;
    gisements.push({
      ressource: id,
      richesse: Math.round(rng.skewed(8, 100, 1.7) * Math.min(1, poids / 10 + 0.45)),
      acces: rng.int(1, type.dangers.length > 1 ? 5 : 4),
    });
  }

  // Ressources exceptionnelles, greffees par-dessus le tirage normal.
  const rare = (id: string, p: number, richesseMax = 45) => {
    if (gisements.some((g) => g.ressource === id) || !rng.chance(p)) return;
    gisements.push({ ressource: id, richesse: Math.round(rng.skewed(4, richesseMax, 2.4)), acces: rng.int(3, 5) });
  };

  // Le kaerium se concentre autour des etoiles mortes et dans les mondes irradies.
  rare('kaerium', ((classe.kaerium ?? 0.35) / 100) * (type.id === 'irradie' ? 4 : 1), 30);
  if (type.categorie === 'geante') rare('antimatiere', 0.02, 20);
  if (zone === 'froide') rare('metamateriaux', 0.015, 35);

  if (rng.chance(0.008)) {
    gisements.push({
      ressource: 'xenomateriaux',
      richesse: Math.round(rng.skewed(10, 60, 1.5)),
      acces: rng.int(3, 5),
      nomUnique: nomXenomateriau(rng),
    });
  }
  return gisements;
}

const REGISTRES_VIE: Record<number, { forme: string; effet: FormeDeVie['effet']; texte: string }[]> = {
  0: [
    { forme: 'tapis microbien', effet: 'benefice', texte: "Fixe l'azote : les cultures y demarrent sans engrais importe." },
    { forme: 'colonie extremophile', effet: 'contrainte', texte: 'Corrode les joints et les canalisations : maintenance permanente.' },
  ],
  1: [
    { forme: 'flore lithophage', effet: 'les deux', texte: 'Dissout la roche et libere des metaux, mais attaque aussi les fondations.' },
    { forme: 'foret fongique', effet: 'benefice', texte: 'Biomasse exploitable sans culture, recolte immediate.' },
  ],
  2: [
    { forme: 'faune grégaire', effet: 'les deux', texte: 'Domesticable, mais les troupeaux migrateurs coupent les routes de surface.' },
    { forme: 'predateurs de surface', effet: 'contrainte', texte: 'Toute installation exterieure doit etre gardee.' },
  ],
  3: [
    { forme: 'ecosysteme coordonne', effet: 'les deux', texte: 'La biosphere reagit aux intrusions comme un organisme unique.' },
    { forme: 'megafaune territoriale', effet: 'contrainte', texte: 'Detruit periodiquement les structures legeres.' },
  ],
  4: [
    { forme: 'civilisation pre-spatiale', effet: 'les deux', texte: 'Main-d oeuvre, savoirs locaux — et un probleme politique des le premier jour.' },
  ],
};

function vieDe(rng: Rng, type: TypePlanete, nommeur: Nommeur): FormeDeVie | null {
  if (!rng.chance(type.vie)) return null;
  const paliers = [0, 1, 2, 3, 4];
  const palier = rng.weighted(paliers, (p) => [46, 24, 16, 10, 2.5][p]);
  const modele = rng.pick(REGISTRES_VIE[palier]);
  return {
    nom: `${nommeur.propre()} ${modele.forme}`,
    palier,
    effet: modele.effet,
    description: modele.texte,
  };
}

/**
 * Cortege de lunes. Ce n'est pas l'apanage des geantes : un monde tellurique
 * massif en capture aussi, et une petite lune tourne parfois autour d'un monde
 * modeste. Ce qui compte est la masse, pas la categorie.
 */
function lunesDe(rng: Rng, type: TypePlanete, rayonKm: number, nommeur: Nommeur): Lune[] {
  let n: number;
  if (type.categorie === 'geante') n = rng.weighted([0, 1, 2, 3, 4, 5, 6], (k) => [8, 16, 22, 20, 15, 11, 8][k]);
  else if (rayonKm > 11000) n = rng.weighted([0, 1, 2, 3], (k) => [30, 34, 22, 14][k]);
  else if (rayonKm > 7000) n = rng.weighted([0, 1, 2], (k) => [48, 36, 16][k]);
  else if (rayonKm > 3500) n = rng.weighted([0, 1], (k) => [72, 28][k]);
  else n = rng.chance(0.08) ? 1 : 0;

  const lunes: Lune[] = [];
  for (let i = 0; i < n; i++) {
    // Une lune ne depasse jamais le tiers de son monde : au-dela c'est un couple.
    const rayonLune = Math.round(Math.min(rayonKm * 0.34, rng.skewed(120, 3400, 1.5)));
    lunes.push({
      nom: nommeur.propre(),
      rayonKm: rayonLune,
      gisements: [
        {
          ressource: rng.weighted(['fer_nickel', 'eau', 'regolithe', 'silice', 'helium3'], (id) =>
            id === 'helium3' ? (type.categorie === 'geante' ? 4 : 1) : 6,
          ),
          richesse: Math.round(rng.skewed(10, 85, 1.6)),
          acces: rng.int(1, 3),
        },
      ],
    });
  }
  return lunes;
}

/**
 * Anneaux. Frequents autour des geantes, rares mais bien reels ailleurs : il
 * suffit d'une lune brisee ou d'un corps disloque par la maree pour en laisser
 * un autour d'un monde rocheux.
 */
function anneauxDe(rng: Rng, type: TypePlanete, rayonKm: number, graviteG: number): boolean {
  if (type.categorie === 'geante') return rng.chance(0.42);
  if (type.id === 'volcanique' || type.id === 'irradie') return rng.chance(0.05);
  const p = rayonKm > 9000 ? 0.045 : rayonKm > 5000 ? 0.025 : 0.012;
  return rng.chance(p * (graviteG > 1.2 ? 1.6 : 1));
}

export function genererPlanetes(
  rng: Rng,
  classe: ClasseStellaire,
  nommeur: Nommeur,
): Planete[] {
  const n = nombreDePlanetes(rng, classe);
  const masse = Math.pow(classe.luminosite, 0.25); // masse stellaire approchee
  const planetes: Planete[] = [];

  let distance = 0.14 * Math.sqrt(Math.max(0.02, classe.luminosite)) * rng.range(0.7, 1.7);
  let dejaHabitable = false;

  for (let i = 0; i < n; i++) {
    const zone = zoneDe(distance, classe.luminosite);
    const type = choisirType(rng, zone, dejaHabitable);
    const rayonKm = Math.round(rng.range(type.rayon_km[0], type.rayon_km[1]));
    const gravite = graviteDe(rng, type, rayonKm);
    const anneeJ = Math.round(Math.sqrt(Math.pow(distance, 3) / masse) * 365.25 * 10) / 10;

    // Verrouillage gravitationnel : frequent dans la zone temperee d'une naine rouge.
    const verrouille = classe.id === 'M' && zone !== 'froide' && rng.chance(0.7);
    const jourH = verrouille ? anneeJ * 24 : Number(rng.range(6, 90).toFixed(1));

    let habitabilite = type.habitabilite;
    habitabilite += classe.habitabilite ?? 0;
    if (verrouille) habitabilite -= 22;
    if (classe.id === 'A') habitabilite -= 18;
    if (gravite > 1.5) habitabilite -= (gravite - 1.5) * 24;
    if (gravite < 0.35) habitabilite -= (0.35 - gravite) * 40;
    habitabilite = Math.max(0, Math.min(100, Math.round(habitabilite + rng.range(-8, 8))));

    const habitable = Boolean(type.habitable) && habitabilite >= SEUIL_HABITABLE;
    if (habitable) dejaHabitable = true;

    const vie = vieDe(rng, type, nommeur);
    const gisements = gisementsDe(rng, type, classe, zone);

    // Toute vie au-dela du stade microbien est en soi une ressource : c'est la
    // matiere premiere de la xenologie et des croisements.
    if (vie && vie.palier >= 1) {
      gisements.push({
        ressource: 'echantillons_bio',
        richesse: Math.round(rng.skewed(20, 100, 1.2) * (0.5 + vie.palier * 0.14)),
        acces: Math.min(5, 2 + vie.palier),
      });
    }

    const emplacements = Math.max(
      4,
      Math.min(16, Math.round((type.categorie === 'geante' ? 6 : rayonKm / 1100) + (habitable ? 4 : 0))),
    );

    planetes.push({
      id: `${i}`,
      nom: rng.chance(0.72) ? nommeur.propre() : nommeur.catalogue('P'),
      orbite: i,
      distanceUA: Number(distance.toFixed(3)),
      zone,
      type: type.id,
      rayonKm,
      graviteG: gravite,
      jourH: Number(jourH.toFixed(1)),
      anneeJ,
      temperatureC: temperatureDe(distance, classe.luminosite, type),
      atmosphere: type.atmosphere,
      habitabilite,
      habitable,
      gisements,
      lunes: lunesDe(rng, type, rayonKm, nommeur),
      anneaux: anneauxDe(rng, type, rayonKm, gravite),
      dangers: [...type.dangers],
      vie,
      artefact: rng.chance(vie && vie.palier >= 3 ? 0.05 : 0.015),
      emplacements,
    });

    distance *= rng.range(1.35, 2.05);
  }

  return planetes;
}

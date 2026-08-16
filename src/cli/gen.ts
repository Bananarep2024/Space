/**
 * Verification du generateur en mode console.
 *
 *   npm run gen                  -- germe aleatoire, 300 systemes
 *   npm run gen -- ITHARA-4718   -- germe impose
 *   npm run gen -- ITHARA-4718 600
 *
 * Aucun rendu, aucun navigateur : c'est precisement l'interet d'avoir isole le
 * noyau. Ce script sert de test d'equilibrage rapide — on relance quelques
 * germes et on regarde si la distribution des mondes reste jouable.
 */

import {
  CONFIG,
  formaterDuree,
  genererGalaxie,
  germeAleatoire,
  PALIER_MAX,
  porteeUtile,
  ressource,
  trajetLePlusRapide,
  typePlanete,
} from '../core/index';
import type { Galaxie } from '../core/types';

const germe = process.argv[2] ?? germeAleatoire();
const systemes = Number(process.argv[3] ?? CONFIG.carte.tailles.standard);
const joueurs = Number(process.argv[4] ?? 6);

const debut = Date.now();
const galaxie = genererGalaxie({ germe, systemes, joueurs });
const duree = Date.now() - debut;

const titre = (t: string) => console.log(`\n\x1b[38;5;180m── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}\x1b[0m`);
const ligne = (cle: string, valeur: string | number) =>
  console.log(`  ${cle.padEnd(34, '.')} ${valeur}`);

titre('Galaxie');
ligne('germe', galaxie.germe);
ligne('systemes', galaxie.systemes.length);
ligne('routes de saut', galaxie.routes.length);
ligne('dont routes longues (propulsion requise)', galaxie.routes.filter((r) => r.longue).length);
ligne('nebuleuses', galaxie.nebuleuses.length);
ligne('trous de ver', galaxie.trousDeVer.length);
ligne('generation', `${duree} ms`);

titre('Planetes');
const toutes = galaxie.systemes.flatMap((s) => s.planetes);
ligne('total', toutes.length);
ligne('moyenne par systeme', (toutes.length / galaxie.systemes.length).toFixed(2));

const parNombre = new Map<number, number>();
for (const s of galaxie.systemes) parNombre.set(s.planetes.length, (parNombre.get(s.planetes.length) ?? 0) + 1);
const maxBarre = Math.max(...parNombre.values());
for (let n = 1; n <= 12; n++) {
  const c = parNombre.get(n) ?? 0;
  console.log(`  ${String(n).padStart(2)} planete(s) │ ${'█'.repeat(Math.round((c / maxBarre) * 34))} ${c}`);
}

titre('Types de mondes');
const parType = new Map<string, number>();
for (const p of toutes) parType.set(p.type, (parType.get(p.type) ?? 0) + 1);
[...parType.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([id, c]) =>
    ligne(typePlanete(id).nom, `${c}  (${((c / toutes.length) * 100).toFixed(1)} %)`),
  );

titre('Habitabilite');
const mondesHabitables = toutes.filter((p) => p.habitable);
const systemesHabitables = galaxie.systemes.filter((s) => s.habitables > 0);
ligne('mondes habitables', mondesHabitables.length);
ligne('systemes en comptant au moins un', `${systemesHabitables.length}  (${((systemesHabitables.length / galaxie.systemes.length) * 100).toFixed(1)} %)`);
ligne('systemes en comptant deux', galaxie.systemes.filter((s) => s.habitables >= 2).length);
ligne('positions de depart', galaxie.systemes.filter((s) => s.joueurDepart !== null).length);

titre('Ressources');
const parRessource = new Map<string, number>();
for (const p of toutes) for (const g of p.gisements) parRessource.set(g.ressource, (parRessource.get(g.ressource) ?? 0) + 1);
[...parRessource.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([id, c]) => ligne(ressource(id).nom, `${c} gisements`));

titre('Curiosites');
ligne('artefacts enfouis', toutes.filter((p) => p.artefact).length);
ligne('mondes porteurs de vie', toutes.filter((p) => p.vie).length);
ligne('dont vie intelligente', toutes.filter((p) => p.vie && p.vie.palier >= 4).length);
const xeno = toutes.flatMap((p) => p.gisements.filter((g) => g.nomUnique));
ligne('xenomateriaux inedits', xeno.length);
if (xeno.length) console.log(`     ${xeno.map((g) => g.nomUnique).join(', ')}`);

titre('Deplacement');
function extremites(g: Galaxie): [number, number] {
  let a = 0, b = 0, max = -1;
  for (let i = 0; i < g.systemes.length; i += 3)
    for (let j = i + 1; j < g.systemes.length; j += 3) {
      const d = Math.hypot(
        g.systemes[i].pos[0] - g.systemes[j].pos[0],
        g.systemes[i].pos[1] - g.systemes[j].pos[1],
        g.systemes[i].pos[2] - g.systemes[j].pos[2],
      );
      if (d > max) { max = d; a = i; b = j; }
    }
  return [a, b];
}
const [ouest, est] = extremites(galaxie);
for (const palier of [0, PALIER_MAX]) {
  const t = trajetLePlusRapide(galaxie, ouest, est, 'eclaireur', palier);
  ligne(
    `traversee, eclaireur, palier ${palier}`,
    t ? `${formaterDuree(t.temps)}  (${t.sauts} sauts, ${t.distanceAl} al)` : 'hors d\'atteinte',
  );
}
const depart = galaxie.systemes.find((s) => s.joueurDepart === 0);
if (depart) {
  for (const palier of [0, PALIER_MAX]) {
    ligne(
      `systemes a moins de 10 min, palier ${palier}`,
      porteeUtile(galaxie, depart.id, 600, 'eclaireur', palier).length,
    );
  }
}

titre('Systeme de depart du joueur 1');
if (depart) {
  console.log(`  ${depart.nom} — ${depart.classe} — ${depart.planetes.length} mondes\n`);
  for (const p of depart.planetes) {
    const res = p.gisements.map((g) => `${ressource(g.ressource).nom} ${g.richesse}`).join(', ');
    console.log(
      `  ${String(p.orbite + 1).padStart(2)}. ${p.nom.padEnd(12)} ${typePlanete(p.type).nom.padEnd(26)}` +
        ` ${String(p.distanceUA).padStart(7)} UA  hab ${String(p.habitabilite).padStart(3)}${p.habitable ? ' ◆' : '  '}`,
    );
    console.log(`      ${res}`);
  }
}
console.log('');

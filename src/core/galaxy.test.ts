/**
 * Invariants du generateur.
 *
 * Ces tests ne verifient pas un rendu, ils verifient des regles de conception :
 * un germe donne toujours la meme carte, aucun systeme n'est vide, aucun joueur
 * ne commence sans monde habitable. Ce sont exactement les garanties qu'il
 * faudra retrouver a l'identique apres le portage en C# pour Unity.
 */

import { describe, expect, it } from 'vitest';
import { CONFIG, genererGalaxie, porteeDe, trajetLePlusRapide } from './index';
import type { Galaxie } from './types';

const GERME = 'ITHARA-4718';
const galaxie = genererGalaxie({ germe: GERME, systemes: 300, joueurs: 6 });

function composantePrincipale(g: Galaxie, portee: number): number {
  const voisins: number[][] = g.systemes.map(() => []);
  for (const r of g.routes) {
    if (r.d > portee) continue;
    voisins[r.a].push(r.b);
    voisins[r.b].push(r.a);
  }
  const vus = new Array(g.systemes.length).fill(false);
  let max = 0;
  for (let depart = 0; depart < g.systemes.length; depart++) {
    if (vus[depart]) continue;
    let taille = 0;
    const pile = [depart];
    vus[depart] = true;
    while (pile.length) {
      const c = pile.pop()!;
      taille++;
      for (const v of voisins[c]) if (!vus[v]) { vus[v] = true; pile.push(v); }
    }
    max = Math.max(max, taille);
  }
  return max;
}

describe('determinisme', () => {
  it('produit la meme galaxie pour le meme germe', () => {
    const bis = genererGalaxie({ germe: GERME, systemes: 300, joueurs: 6 });
    expect(JSON.stringify(bis)).toBe(JSON.stringify(galaxie));
  });

  it('produit une galaxie differente pour un autre germe', () => {
    const autre = genererGalaxie({ germe: 'VHAOst-2210', systemes: 300, joueurs: 6 });
    expect(JSON.stringify(autre)).not.toBe(JSON.stringify(galaxie));
  });
});

describe('systemes', () => {
  it('en genere le nombre demande', () => {
    expect(galaxie.systemes).toHaveLength(300);
  });

  it('donne a chaque systeme entre 1 et 12 planetes', () => {
    for (const s of galaxie.systemes) {
      expect(s.planetes.length).toBeGreaterThanOrEqual(1);
      expect(s.planetes.length).toBeLessThanOrEqual(12);
    }
  });

  it('nomme chaque systeme de facon unique', () => {
    const noms = new Set(galaxie.systemes.map((s) => s.nom));
    expect(noms.size).toBe(galaxie.systemes.length);
  });

  it('ordonne les planetes par distance croissante', () => {
    for (const s of galaxie.systemes) {
      for (let i = 1; i < s.planetes.length; i++) {
        expect(s.planetes[i].distanceUA).toBeGreaterThan(s.planetes[i - 1].distanceUA);
      }
    }
  });

  it('couvre une large variete de types de mondes', () => {
    const types = new Set(galaxie.systemes.flatMap((s) => s.planetes.map((p) => p.type)));
    expect(types.size).toBeGreaterThanOrEqual(12);
  });
});

describe('topologie', () => {
  it('relie la quasi-totalite des systemes des la portee de saut initiale', () => {
    const taille = composantePrincipale(galaxie, porteeDe(0));
    expect(taille / galaxie.systemes.length).toBeGreaterThan(0.85);
  });

  it('relie la totalite des systemes a la portee maximale', () => {
    expect(composantePrincipale(galaxie, porteeDe(5))).toBe(galaxie.systemes.length);
  });

  it('conserve des routes longues, inutilisables sans propulsion', () => {
    expect(galaxie.routes.filter((r) => r.longue).length).toBeGreaterThan(0);
  });
});

describe('positions de depart', () => {
  const departs = galaxie.systemes.filter((s) => s.joueurDepart !== null);

  it('en pose une par joueur', () => {
    expect(departs).toHaveLength(6);
  });

  it('garantit un monde habitable a chacun', () => {
    for (const s of departs) expect(s.planetes.some((p) => p.habitable)).toBe(true);
  });

  it('les rend joignables entre elles', () => {
    for (const s of departs.slice(1)) {
      expect(trajetLePlusRapide(galaxie, departs[0].id, s.id, 'eclaireur', 0)).not.toBeNull();
    }
  });
});

describe('deplacement', () => {
  it('fait de la traversee une affaire de dizaines de minutes au palier 0', () => {
    const a = galaxie.systemes.reduce((x, y) => (x.pos[0] < y.pos[0] ? x : y));
    const b = galaxie.systemes.reduce((x, y) => (x.pos[0] > y.pos[0] ? x : y));
    const t = trajetLePlusRapide(galaxie, a.id, b.id, 'eclaireur', 0);
    expect(t).not.toBeNull();
    expect(t!.temps).toBeGreaterThan(20 * 60);
    expect(t!.temps).toBeLessThan(75 * 60);
  });

  it('raccourcit nettement le trajet au palier maximal', () => {
    const a = galaxie.systemes.reduce((x, y) => (x.pos[0] < y.pos[0] ? x : y));
    const b = galaxie.systemes.reduce((x, y) => (x.pos[0] > y.pos[0] ? x : y));
    const lent = trajetLePlusRapide(galaxie, a.id, b.id, 'eclaireur', 0)!;
    const rapide = trajetLePlusRapide(galaxie, a.id, b.id, 'eclaireur', 5)!;
    expect(rapide.temps).toBeLessThan(lent.temps * 0.55);
    expect(rapide.sauts).toBeLessThan(lent.sauts);
  });

  it('respecte la hierarchie des classes de vaisseaux', () => {
    const a = galaxie.systemes[0].id;
    const b = galaxie.systemes[40].id;
    const eclaireur = trajetLePlusRapide(galaxie, a, b, 'eclaireur', 0);
    const transport = trajetLePlusRapide(galaxie, a, b, 'transport', 0);
    if (eclaireur && transport) expect(transport.temps).toBeGreaterThan(eclaireur.temps);
  });
});

describe('economie', () => {
  it('rend les ressources de masse bien plus communes que les exotiques', () => {
    const compte = (id: string) =>
      galaxie.systemes.flatMap((s) => s.planetes).filter((p) => p.gisements.some((g) => g.ressource === id)).length;
    expect(compte('regolithe')).toBeGreaterThan(compte('kaerium') * 8);
    expect(compte('fer_nickel')).toBeGreaterThan(compte('antimatiere') * 5);
  });

  it('garde la monnaie rare mais presente', () => {
    const gisements = galaxie.systemes
      .flatMap((s) => s.planetes)
      .flatMap((p) => p.gisements)
      .filter((g) => g.ressource === 'kaerium');
    expect(gisements.length).toBeGreaterThan(4);
    expect(gisements.length).toBeLessThan(120);
  });

  it('nomme chaque xenomateriau decouvert', () => {
    for (const s of galaxie.systemes)
      for (const p of s.planetes)
        for (const g of p.gisements)
          if (g.ressource === 'xenomateriaux') expect(g.nomUnique).toBeTruthy();
  });

  it('reste dans la cible d habitabilite', () => {
    const part = galaxie.systemes.filter((s) => s.habitables > 0).length / galaxie.systemes.length;
    expect(part).toBeGreaterThan(0.04);
    expect(part).toBeLessThan(CONFIG.habitabilite.cible_systemes_habitables * 2.2);
  });
});

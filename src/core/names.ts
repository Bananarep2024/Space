/**
 * Generation des noms propres.
 *
 * Deux registres coexistent, comme dans un vrai catalogue d'exploration : les
 * mondes releves recoivent un nom, les points encore anonymes gardent leur
 * designation de catalogue (IX-674). Le contraste renforce l'idee qu'une
 * galaxie n'est pas entierement connue.
 */

import type { Rng } from './rng';

const DEBUTS = [
  'Ith', 'Kor', 'Hal', 'Cey', 'Vesh', 'Thal', 'Sar', 'Omb', 'Ost', 'Vha',
  'Dra', 'Zan', 'Tan', 'Mir', 'Kel', 'Pra', 'Rhen', 'Isk', 'Eri', 'Lum',
  'Cal', 'Bor', 'Anj', 'Med', 'Jor', 'Quen', 'Yss', 'Ulf', 'Tor', 'Gal',
  'Pel', 'Nyr', 'Aeg', 'Veth', 'Kryn', 'Orr', 'Dain', 'Sel', 'Vor', 'Ael',
  'Sib', 'Thren', 'Occ', 'Mar', 'Neb', 'Sur', 'Kaz', 'Del', 'Varn', 'Yul',
];

const FINS = [
  'ara', 'an', 'or', 'is', 'el', 'ur', 'ix', 'yn', 'ath', 'um',
  'ion', 'ak', 'ess', 'ar', 'une', 'om', 'en', 'as', 'eth', 'oria',
  'ys', 'ane', 'ir', 'ol', 'ux', 'ade', 'ern', 'ost', 'ien', 'al',
];

const LIAISONS = ['a', 'e', 'i', 'o', 'ae', 'y'];

/**
 * Distribue des noms uniques. Une instance par galaxie : elle memorise ce qui
 * a deja ete attribue pour qu'aucun nom ne soit servi deux fois.
 */
export class Nommeur {
  private pris = new Set<string>();

  constructor(private rng: Rng) {}

  private brut(): string {
    const debut = this.rng.pick(DEBUTS);
    const fin = this.rng.pick(FINS);
    const liaison = this.rng.chance(0.25) ? this.rng.pick(LIAISONS) : '';
    return debut + liaison + fin;
  }

  /** Nom propre unique. */
  propre(): string {
    for (let essai = 0; essai < 40; essai++) {
      const nom = this.brut();
      if (!this.pris.has(nom)) {
        this.pris.add(nom);
        return nom;
      }
    }
    // Repli : suffixe numerique plutot qu'une boucle infinie.
    let n = 2;
    let base = this.brut();
    while (this.pris.has(`${base} ${n}`)) n++;
    this.pris.add(`${base} ${n}`);
    return `${base} ${n}`;
  }

  /** Designation de catalogue pour un objet non releve. */
  catalogue(prefixe = 'IX'): string {
    for (let essai = 0; essai < 40; essai++) {
      const nom = `${prefixe}-${this.rng.int(100, 999)}`;
      if (!this.pris.has(nom)) {
        this.pris.add(nom);
        return nom;
      }
    }
    let n = 1000;
    while (this.pris.has(`${prefixe}-${n}`)) n++;
    this.pris.add(`${prefixe}-${n}`);
    return `${prefixe}-${n}`;
  }
}

/** Nom d'un xenomateriau : un mot inedit, qui doit sonner comme un mineral. */
export function nomXenomateriau(rng: Rng): string {
  const suffixes = ['ite', 'ium', 'ane', 'yne', 'ore', 'ide'];
  return rng.pick(DEBUTS).toLowerCase().replace(/^./, (c) => c.toUpperCase()) + rng.pick(suffixes);
}

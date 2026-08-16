/**
 * Generateur pseudo-aleatoire deterministe.
 *
 * Toute la galaxie derive d'une seule chaine de caracteres : le germe. Deux
 * parties lancees avec le meme germe produisent exactement la meme carte, sur
 * n'importe quelle machine. C'est ce qui permet de ne transmettre que quelques
 * octets au lieu de deux mille planetes, et de rejouer une partie a l'identique.
 */

/** Hache une chaine en quatre entiers 32 bits (cyrb128). */
function hash128(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: string) {
    [this.a, this.b, this.c, this.d] = hash128(seed);
  }

  /** Flottant dans [0, 1). Algorithme sfc32. */
  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Flottant dans [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Vrai avec la probabilite p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Element uniforme d'un tableau non vide. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Element d'un tableau selon des poids positifs. */
  weighted<T>(items: readonly T[], poids: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, poids(it));
    let seuil = this.next() * total;
    for (const it of items) {
      seuil -= Math.max(0, poids(it));
      if (seuil <= 0) return it;
    }
    return items[items.length - 1];
  }

  /** Loi normale centree reduite (Box-Muller). */
  gaussian(): number {
    const u = Math.max(1e-12, this.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }

  /**
   * Tirage biaise vers le bas : la plupart des gisements sont mediocres,
   * quelques-uns sont exceptionnels. `force` > 1 accentue le biais.
   */
  skewed(min: number, max: number, force = 2): number {
    return min + Math.pow(this.next(), force) * (max - min);
  }

  /** Melange en place (Fisher-Yates). */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /**
   * Flux independant derive du germe courant. Permet de generer les planetes
   * d'un systeme sans perturber la suite du tirage des autres systemes : on
   * peut ainsi generer un systeme a la demande, des annees apres la partie.
   */
  derive(etiquette: string): Rng {
    return new Rng(`${this.a}:${this.b}:${this.c}:${this.d}:${etiquette}`);
  }
}

/** Germe lisible du type "ITHARA-4718", facile a recopier et a partager. */
export function germeAleatoire(): string {
  const syllabes = ['ITH', 'KOR', 'VHA', 'OST', 'CEY', 'DRA', 'SAR', 'THA', 'ZAN', 'ERI', 'NYR', 'ORR'];
  const a = syllabes[Math.floor(Math.random() * syllabes.length)];
  const b = syllabes[Math.floor(Math.random() * syllabes.length)];
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `${a}${b.toLowerCase()}-${n}`;
}

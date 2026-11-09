/**
 * Generatore pseudo-casuale deterministico (mulberry32).
 *
 * Motivo: il seed dei dati mock deve produrre SEMPRE gli stessi numeri.
 * Una demo riproducibile è essenziale per presentare il prototipo: le cifre
 * mostrate all'azienda non devono cambiare a ogni reinstallazione.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float uniforme in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Intero uniforme in [min, max] (estremi inclusi). */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** `count` elementi distinti presi da `items`. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    const take = Math.min(count, pool.length);
    for (let i = 0; i < take; i += 1) {
      result.push(pool.splice(this.int(0, pool.length - 1), 1)[0]);
    }
    return result;
  }

  /** Distribuzione normale (Box-Muller): rendimenti giornalieri realistici. */
  normal(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), 1e-9);
    const u2 = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

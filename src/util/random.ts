/**
 * Seeded randomness.
 *
 * Sigils must be reproducible: an archive entry stores only a seed, and
 * reopening it has to draw exactly the same mark months later. Math.random
 * cannot do that, so everything generative in ARCANUM runs through here.
 */

/** xmur3 — turns a string into a well-mixed 32-bit integer. */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

/** mulberry32 — small, fast, and good enough for geometry. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  /** A float in [0, 1). */
  next(): number
  /** A float in [min, max). */
  range(min: number, max: number): number
  /** An integer in [min, max], inclusive. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  chance(probability: number): boolean
  /** A float in [-magnitude, magnitude). */
  jitter(magnitude: number): number
}

export function createRng(seed: string | number): Rng {
  const next = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed)
  const range = (min: number, max: number) => min + next() * (max - min)
  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
    jitter: (magnitude) => range(-magnitude, magnitude),
  }
}

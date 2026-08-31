import { describe, it, expect } from 'vitest'
import { RITUAL_INTENTS } from '../src/rituals/types'
import {
  SIGIL_VIEWBOX,
  generateSigil,
  renderSigilSvg,
  type SigilPrimitive,
} from '../src/visuals/sigilGenerator'
import { hashSeed, mulberry32 } from '../src/util/random'

describe('seeded random', () => {
  it('hashes a string to a stable 32-bit integer', () => {
    expect(hashSeed('arcanum')).toBe(hashSeed('arcanum'))
    expect(hashSeed('arcanum')).not.toBe(hashSeed('arcanvm'))
    expect(Number.isInteger(hashSeed('x'))).toBe(true)
  })

  it('produces a deterministic sequence in [0, 1)', () => {
    const a = mulberry32(hashSeed('seed-a'))
    const b = mulberry32(hashSeed('seed-a'))
    for (let i = 0; i < 200; i++) {
      const value = a()
      expect(value).toBe(b())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('diverges for different seeds', () => {
    const a = mulberry32(hashSeed('seed-a'))
    const b = mulberry32(hashSeed('seed-b'))
    const left = Array.from({ length: 10 }, a)
    const right = Array.from({ length: 10 }, b)
    expect(left).not.toEqual(right)
  })
})

describe('sigil generator', () => {
  it('is deterministic for the same seed and intent', () => {
    for (const intent of RITUAL_INTENTS) {
      const first = generateSigil('guard-standing-line:ritual:abc', intent)
      const second = generateSigil('guard-standing-line:ritual:abc', intent)
      expect(first).toEqual(second)
      expect(renderSigilSvg(first)).toBe(renderSigilSvg(second))
    }
  })

  it('produces different geometry for different seeds', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `mend-slow-repair:deep:seed-${i}`)
    const rendered = new Set(seeds.map((seed) => renderSigilSvg(generateSigil(seed, 'mend'))))
    expect(rendered.size).toBe(seeds.length)
  })

  it('produces different geometry for different intents on the same seed', () => {
    const rendered = new Set(
      RITUAL_INTENTS.map((intent) => renderSigilSvg(generateSigil('one-seed', intent))),
    )
    expect(rendered.size).toBe(RITUAL_INTENTS.length)
  })

  const allSeeds = Array.from({ length: 30 }, (_, i) => `probe-${i}`)

  it('always composes a readable number of primitives', () => {
    for (const intent of RITUAL_INTENTS) {
      for (const seed of allSeeds) {
        const spec = generateSigil(seed, intent)
        expect(spec.primitives.length, `${intent}/${seed}`).toBeGreaterThanOrEqual(6)
        expect(spec.primitives.length, `${intent}/${seed}`).toBeLessThanOrEqual(60)
      }
    }
  })

  it('keeps every coordinate finite and inside the frame', () => {
    const coords = (primitive: SigilPrimitive): number[] => {
      switch (primitive.kind) {
        case 'ring':
        case 'node':
          return [primitive.cx, primitive.cy, primitive.r]
        case 'line':
          return [primitive.x1, primitive.y1, primitive.x2, primitive.y2]
        case 'arc':
          return [primitive.cx, primitive.cy, primitive.r]
        case 'path':
          return primitive.points.flat()
      }
    }
    for (const intent of RITUAL_INTENTS) {
      for (const seed of allSeeds) {
        for (const primitive of generateSigil(seed, intent).primitives) {
          for (const value of coords(primitive)) {
            expect(Number.isFinite(value), `${intent}/${seed}`).toBe(true)
            expect(value).toBeGreaterThanOrEqual(-2)
            expect(value).toBeLessThanOrEqual(SIGIL_VIEWBOX + 2)
          }
        }
      }
    }
  })

  it('always carries the shared frame that makes the set one family', () => {
    for (const intent of RITUAL_INTENTS) {
      for (const seed of allSeeds) {
        const spec = generateSigil(seed, intent)
        const rings = spec.primitives.filter((p) => p.kind === 'ring')
        expect(rings.length, `${intent}/${seed}`).toBeGreaterThanOrEqual(1)
        const centre = SIGIL_VIEWBOX / 2
        expect(rings.some((ring) => ring.cx === centre && ring.cy === centre)).toBe(true)
      }
    }
  })

  it('gives each intent its own geometric bias', () => {
    const count = (intent: (typeof RITUAL_INTENTS)[number], kind: SigilPrimitive['kind']) => {
      let total = 0
      for (const seed of allSeeds) {
        total += generateSigil(seed, intent).primitives.filter((p) => p.kind === kind).length
      }
      return total / allSeeds.length
    }
    // GUARD encloses, so it carries more rings than CLEAR, which empties out.
    expect(count('guard', 'ring')).toBeGreaterThan(count('clear', 'ring'))
    // SEEK is an astrolabe: more orbital arcs than RESOLVE, which is axial.
    expect(count('seek', 'arc')).toBeGreaterThan(count('resolve', 'arc'))
    // RESOLVE drives lines along an axis.
    expect(count('resolve', 'line')).toBeGreaterThan(count('still', 'line'))
  })

  it('renders valid, self-contained SVG markup', () => {
    const svg = renderSigilSvg(generateSigil('render-check', 'seek'))
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    expect(svg).toContain(`viewBox="0 0 ${SIGIL_VIEWBOX} ${SIGIL_VIEWBOX}"`)
    expect(svg).not.toContain('NaN')
    expect(svg).not.toContain('undefined')
  })

  it('can render a partially resonant sigil for the completion animation', () => {
    const spec = generateSigil('progressive', 'guard')
    const partial = renderSigilSvg(spec, { resonance: 0.4 })
    const full = renderSigilSvg(spec, { resonance: 1 })
    expect(partial).not.toBe(full)
    expect(partial).not.toContain('NaN')
  })
})

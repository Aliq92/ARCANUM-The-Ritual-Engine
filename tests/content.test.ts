import { describe, it, expect } from 'vitest'
import {
  RITUAL_INTENTS,
  RITUAL_INTENSITIES,
  breathCycleSeconds,
  invocationLines,
  isRitualIntent,
  type RitualDefinition,
} from '../src/rituals/types'
import { ALL_RITUALS, ritualsByIntent, getRitualById } from '../src/rituals/index'

describe('ritual library', () => {
  it('contains between 72 and 96 ritual variants', () => {
    expect(ALL_RITUALS.length).toBeGreaterThanOrEqual(72)
    expect(ALL_RITUALS.length).toBeLessThanOrEqual(96)
  })

  it('provides 12-15 variants for every intent', () => {
    for (const intent of RITUAL_INTENTS) {
      const set = ritualsByIntent(intent)
      expect(set.length, `${intent} variant count`).toBeGreaterThanOrEqual(12)
      expect(set.length, `${intent} variant count`).toBeLessThanOrEqual(15)
    }
  })

  it('has globally unique ritual ids', () => {
    const ids = ALL_RITUALS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has globally unique ritual titles', () => {
    const titles = ALL_RITUALS.map((r) => r.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('resolves every ritual by id', () => {
    for (const ritual of ALL_RITUALS) {
      expect(getRitualById(ritual.id)).toBe(ritual)
    }
    expect(getRitualById('does-not-exist')).toBeUndefined()
  })
})

describe.each(RITUAL_INTENTS)('intent "%s"', (intent) => {
  it('files every ritual under its own intent, prefixed by id', () => {
    for (const ritual of ritualsByIntent(intent)) {
      expect(ritual.intent).toBe(intent)
      expect(ritual.id.startsWith(`${intent}-`), `${ritual.id} id prefix`).toBe(true)
    }
  })
})

describe('every ritual definition', () => {
  const check = (name: string, fn: (ritual: RitualDefinition) => void) => {
    it(name, () => {
      for (const ritual of ALL_RITUALS) {
        try {
          fn(ritual)
        } catch (error) {
          throw new Error(`[${ritual.id}] ${(error as Error).message}`)
        }
      }
    })
  }

  check('has a well-formed id', (r) => {
    expect(r.id).toMatch(/^[a-z]+-[a-z0-9-]+$/)
  })

  check('has a valid intent', (r) => {
    expect(isRitualIntent(r.intent)).toBe(true)
  })

  check('has a title', (r) => {
    expect(r.title.trim().length).toBeGreaterThan(2)
    expect(r.title.length).toBeLessThanOrEqual(40)
  })

  check('has a single-sentence opening phrase', (r) => {
    expect(r.opening.trim().length).toBeGreaterThan(12)
    expect(r.opening.length).toBeLessThanOrEqual(120)
  })

  check('has a multi-line authored invocation', (r) => {
    const lines = invocationLines(r)
    expect(lines.length).toBeGreaterThanOrEqual(4)
    expect(lines.length).toBeLessThanOrEqual(10)
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(10)
      expect(line.length).toBeLessThanOrEqual(160)
    }
  })

  check('has at least one usable breath pattern', (r) => {
    expect(r.breathPatterns.length).toBeGreaterThanOrEqual(1)
    expect(r.breathPatterns.length).toBeLessThanOrEqual(3)
    for (const pattern of r.breathPatterns) {
      expect(pattern.inhale).toBeGreaterThanOrEqual(2)
      expect(pattern.exhale).toBeGreaterThanOrEqual(pattern.inhale)
      expect(pattern.holdIn).toBeGreaterThanOrEqual(0)
      expect(pattern.holdOut).toBeGreaterThanOrEqual(0)
      const cycle = breathCycleSeconds(pattern)
      expect(cycle).toBeGreaterThanOrEqual(8)
      expect(cycle).toBeLessThanOrEqual(24)
    }
  })

  check('has concrete grounding actions', (r) => {
    expect(r.groundingActions.length).toBeGreaterThanOrEqual(3)
    for (const action of r.groundingActions) {
      expect(action.trim().length).toBeGreaterThan(10)
      expect(action.length).toBeLessThanOrEqual(120)
    }
    expect(new Set(r.groundingActions).size).toBe(r.groundingActions.length)
  })

  check('has ascending silence durations for every intensity', (r) => {
    for (const intensity of RITUAL_INTENSITIES) {
      expect(typeof r.silenceSeconds[intensity]).toBe('number')
      expect(r.silenceSeconds[intensity]).toBeGreaterThan(0)
    }
    expect(r.silenceSeconds.whisper).toBeLessThan(r.silenceSeconds.ritual)
    expect(r.silenceSeconds.ritual).toBeLessThan(r.silenceSeconds.deep)
    expect(r.silenceSeconds.whisper).toBeGreaterThanOrEqual(10)
    expect(r.silenceSeconds.deep).toBeLessThanOrEqual(150)
  })
})

describe('content safety', () => {
  const forbidden = [
    /\bcurse\b/i,
    /\bhex\b/i,
    /\brevenge\b/i,
    /\bvengeance\b/i,
    /\bsmite\b/i,
    /\bdestroy (them|him|her)\b/i,
    /\bmake them\b/i,
    /\bforce (them|him|her)\b/i,
    /\bcommand (them|him|her)\b/i,
  ]

  it('never invokes harm, coercion or control of another person', () => {
    for (const ritual of ALL_RITUALS) {
      const text = `${ritual.title} ${ritual.opening} ${ritual.invocation} ${ritual.groundingActions.join(' ')}`
      for (const pattern of forbidden) {
        expect(pattern.test(text), `${ritual.id} matched ${pattern}`).toBe(false)
      }
    }
  })

  it('never presents authored text as scripture or an authentic sacred source', () => {
    const impersonation = [/\bquran\b/i, /\bhadith\b/i, /\bscripture\b/i, /\bholy book\b/i, /\bthus it is written\b/i]
    for (const ritual of ALL_RITUALS) {
      const text = `${ritual.opening} ${ritual.invocation}`
      for (const pattern of impersonation) {
        expect(pattern.test(text), `${ritual.id} matched ${pattern}`).toBe(false)
      }
    }
  })
})

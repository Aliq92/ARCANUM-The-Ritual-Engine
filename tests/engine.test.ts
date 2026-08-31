import { describe, it, expect, vi } from 'vitest'
import { RITUAL_INTENSITIES, RITUAL_INTENTS } from '../src/rituals/types'
import { ALL_RITUALS, ritualsByIntent, selectRitual } from '../src/rituals/index'
import { RitualEngine, planSession } from '../src/engine/ritualEngine'
import { Resonance, RESONANCE_MARKS } from '../src/engine/resonance'

describe('ritual selection', () => {
  it('returns a ritual belonging to the requested intent', () => {
    for (const intent of RITUAL_INTENTS) {
      for (let i = 0; i < 40; i++) {
        const ritual = selectRitual(intent)
        expect(ritual.intent).toBe(intent)
        expect(ALL_RITUALS).toContain(ritual)
      }
    }
  })

  it('returns a ritual with an id, an invocation and grounding actions', () => {
    const ritual = selectRitual('guard')
    expect(ritual.id.length).toBeGreaterThan(0)
    expect(ritual.invocation.length).toBeGreaterThan(0)
    expect(ritual.groundingActions.length).toBeGreaterThan(0)
    expect(ritual.title.length).toBeGreaterThan(0)
  })

  it('avoids recently used rituals when it can', () => {
    const pool = ritualsByIntent('still')
    const avoid = pool.slice(0, pool.length - 1).map((r) => r.id)
    for (let i = 0; i < 20; i++) {
      expect(selectRitual('still', { avoidIds: avoid }).id).toBe(pool[pool.length - 1].id)
    }
  })

  it('falls back to the whole set when everything has been seen', () => {
    const avoid = ritualsByIntent('mend').map((r) => r.id)
    const ritual = selectRitual('mend', { avoidIds: avoid })
    expect(ritual.intent).toBe('mend')
  })

  it('never indexes past the end of the pool', () => {
    const ritual = selectRitual('seek', { random: () => 0.999999999 })
    expect(ritual).toBeDefined()
    expect(ritual.intent).toBe('seek')
  })
})

describe('planSession', () => {
  const ritual = ritualsByIntent('guard')[0]

  it('lands close to the advertised duration for each intensity', () => {
    const expected = { whisper: 60, ritual: 180, deep: 300 }
    for (const intensity of RITUAL_INTENSITIES) {
      const plan = planSession(ritual, intensity)
      const target = expected[intensity]
      expect(plan.totalSeconds, `${intensity}`).toBeGreaterThan(target * 0.75)
      expect(plan.totalSeconds, `${intensity}`).toBeLessThan(target * 1.25)
    }
  })

  it('grows monotonically with intensity for every ritual', () => {
    for (const definition of ALL_RITUALS) {
      const whisper = planSession(definition, 'whisper').totalSeconds
      const standard = planSession(definition, 'ritual').totalSeconds
      const deep = planSession(definition, 'deep').totalSeconds
      expect(whisper, definition.id).toBeLessThan(standard)
      expect(standard, definition.id).toBeLessThan(deep)
    }
  })

  it('builds whole breath cycles that match the ritual patterns', () => {
    const plan = planSession(ritual, 'ritual')
    expect(plan.breathPhases.length).toBeGreaterThan(0)
    const cycles = new Set(plan.breathPhases.map((phase) => phase.cycleIndex))
    expect(plan.breathCycles).toBe(cycles.size)
    expect(plan.breathCycles).toBeGreaterThanOrEqual(2)
    for (const phase of plan.breathPhases) {
      expect(phase.seconds).toBeGreaterThan(0)
      expect(['inhale', 'holdIn', 'exhale', 'holdOut']).toContain(phase.kind)
    }
    const first = plan.breathPhases[0]
    expect(first.kind).toBe('inhale')
  })

  it('gives every invocation line a display duration', () => {
    for (const intensity of RITUAL_INTENSITIES) {
      const plan = planSession(ritual, intensity)
      expect(plan.invocationLines.length).toBe(plan.invocationLineSeconds.length)
      for (const seconds of plan.invocationLineSeconds) expect(seconds).toBeGreaterThan(0)
    }
  })

  it('takes the silence duration from the ritual definition', () => {
    for (const intensity of RITUAL_INTENSITIES) {
      expect(planSession(ritual, intensity).silenceSeconds).toBe(ritual.silenceSeconds[intensity])
    }
  })
})

describe('RitualEngine', () => {
  it('starts a session and reports it as active', () => {
    const engine = new RitualEngine()
    expect(engine.session).toBeNull()
    const session = engine.begin('clear', 'whisper')
    expect(session.intent).toBe('clear')
    expect(session.ritual.intent).toBe('clear')
    expect(session.intensity).toBe('whisper')
    expect(engine.session).toBe(session)
  })

  it('refuses to run two sessions at once', () => {
    const engine = new RitualEngine()
    engine.begin('guard', 'ritual')
    expect(() => engine.begin('still', 'deep')).toThrow(/already/i)
    expect(engine.session?.intent).toBe('guard')
  })

  it('starts a new session only after the previous one ends', () => {
    const engine = new RitualEngine()
    const first = engine.begin('guard', 'ritual')
    engine.end()
    expect(engine.session).toBeNull()
    const second = engine.begin('still', 'deep')
    expect(second).not.toBe(first)
    expect(second.id).not.toBe(first.id)
  })

  it('chooses one concrete grounding action from the ritual', () => {
    const engine = new RitualEngine()
    const session = engine.begin('resolve', 'ritual')
    expect(session.ritual.groundingActions).toContain(session.groundingAction)
  })

  it('produces a distinct seed per session', () => {
    const engine = new RitualEngine()
    const seeds = new Set<string>()
    for (let i = 0; i < 25; i++) {
      seeds.add(engine.begin('seek', 'whisper').seed)
      engine.end()
    }
    expect(seeds.size).toBe(25)
  })

  it('does not repeat the immediately previous ritual of an intent', () => {
    const engine = new RitualEngine()
    const first = engine.begin('mend', 'whisper')
    engine.end()
    const second = engine.begin('mend', 'whisper')
    expect(second.ritual.id).not.toBe(first.ritual.id)
  })

  it('notifies listeners when a session begins and ends', () => {
    const engine = new RitualEngine()
    const listener = vi.fn()
    engine.subscribe(listener)
    engine.begin('guard', 'whisper')
    engine.end()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenLastCalledWith(null)
  })
})

describe('Resonance', () => {
  it('starts empty and completes at one', () => {
    const resonance = new Resonance()
    expect(resonance.value).toBe(0)
    for (const mark of RESONANCE_MARKS) resonance.mark(mark)
    expect(resonance.value).toBe(1)
    expect(resonance.complete).toBe(true)
  })

  it('counts each mark once', () => {
    const resonance = new Resonance()
    resonance.mark('breath')
    resonance.mark('breath')
    expect(resonance.value).toBeCloseTo(1 / RESONANCE_MARKS.length)
    expect(resonance.has('breath')).toBe(true)
    expect(resonance.has('word')).toBe(false)
  })

  it('resets', () => {
    const resonance = new Resonance()
    resonance.mark('silence')
    resonance.reset()
    expect(resonance.value).toBe(0)
    expect(resonance.marked).toEqual([])
  })

  it('maps every ritual stage to a mark', () => {
    const resonance = new Resonance()
    resonance.markStage('OPENING')
    resonance.markStage('BREATH')
    resonance.markStage('INVOCATION')
    resonance.markStage('SILENCE')
    resonance.markStage('GROUNDING')
    expect(resonance.complete).toBe(true)
  })
})

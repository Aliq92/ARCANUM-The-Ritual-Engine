import { describe, it, expect, vi } from 'vitest'
import {
  RitualStateMachine,
  RITUAL_STAGE_ORDER,
  isActiveRitualState,
  type RitualState,
} from '../src/engine/ritualState'

const walkFullRitual = (machine: RitualStateMachine) => {
  machine.transition('INTENSITY_SELECT')
  for (const stage of RITUAL_STAGE_ORDER) machine.transition(stage)
}

describe('RitualStateMachine', () => {
  it('opens in the chamber', () => {
    expect(new RitualStateMachine().state).toBe('CHAMBER')
  })

  it('moves through the ritual stages in order', () => {
    const machine = new RitualStateMachine()
    const seen: RitualState[] = []
    machine.subscribe((state) => seen.push(state))
    walkFullRitual(machine)
    expect(seen).toEqual(['INTENSITY_SELECT', ...RITUAL_STAGE_ORDER])
    expect(machine.state).toBe('COMPLETION')
  })

  it('rejects transitions that skip a stage', () => {
    const machine = new RitualStateMachine()
    machine.transition('INTENSITY_SELECT')
    machine.transition('OPENING')
    expect(machine.can('SILENCE')).toBe(false)
    expect(machine.transition('SILENCE')).toBe(false)
    expect(machine.state).toBe('OPENING')
  })

  it('ignores a duplicate transition into the state it is already in', () => {
    const machine = new RitualStateMachine()
    const listener = vi.fn()
    machine.transition('INTENSITY_SELECT')
    machine.subscribe(listener)
    expect(machine.transition('INTENSITY_SELECT')).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    expect(machine.state).toBe('INTENSITY_SELECT')
  })

  it('does not notify listeners when a transition is rejected', () => {
    const machine = new RitualStateMachine()
    const listener = vi.fn()
    machine.subscribe(listener)
    expect(machine.transition('GROUNDING')).toBe(false)
    expect(listener).not.toHaveBeenCalled()
  })

  it('allows an abort back to the chamber from every ritual stage', () => {
    for (const stage of RITUAL_STAGE_ORDER) {
      const machine = new RitualStateMachine()
      machine.transition('INTENSITY_SELECT')
      for (const step of RITUAL_STAGE_ORDER) {
        machine.transition(step)
        if (step === stage) break
      }
      expect(machine.state).toBe(stage)
      expect(machine.transition('CHAMBER')).toBe(true)
      expect(machine.state).toBe('CHAMBER')
    }
  })

  it('reaches archive and settings only from outside a ritual', () => {
    const machine = new RitualStateMachine()
    expect(machine.transition('ARCHIVE')).toBe(true)
    expect(machine.transition('SETTINGS')).toBe(true)
    expect(machine.transition('CHAMBER')).toBe(true)

    machine.transition('INTENSITY_SELECT')
    machine.transition('OPENING')
    machine.transition('BREATH')
    expect(machine.can('ARCHIVE')).toBe(false)
    expect(machine.can('SETTINGS')).toBe(false)
  })

  it('reports which states are an active ritual', () => {
    expect(isActiveRitualState('CHAMBER')).toBe(false)
    expect(isActiveRitualState('INTENSITY_SELECT')).toBe(false)
    expect(isActiveRitualState('ARCHIVE')).toBe(false)
    for (const stage of RITUAL_STAGE_ORDER) {
      expect(isActiveRitualState(stage)).toBe(true)
    }
  })

  it('unsubscribes cleanly', () => {
    const machine = new RitualStateMachine()
    const listener = vi.fn()
    const off = machine.subscribe(listener)
    machine.transition('ARCHIVE')
    off()
    machine.transition('CHAMBER')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('resets to the chamber', () => {
    const machine = new RitualStateMachine()
    walkFullRitual(machine)
    machine.reset()
    expect(machine.state).toBe('CHAMBER')
  })
})

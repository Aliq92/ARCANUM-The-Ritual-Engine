import type { RitualStage } from './ritualState'

/**
 * RESONANCE is the ritual's progress metaphor. It is not a score, and it
 * carries nothing between sessions: it exists only so the geometry has
 * something to align to as the ritual proceeds.
 */
export const RESONANCE_MARKS = ['focus', 'breath', 'word', 'silence', 'action'] as const
export type ResonanceMark = (typeof RESONANCE_MARKS)[number]

const STAGE_MARKS: Partial<Record<RitualStage, ResonanceMark>> = {
  OPENING: 'focus',
  BREATH: 'breath',
  INVOCATION: 'word',
  SILENCE: 'silence',
  GROUNDING: 'action',
}

export class Resonance {
  #marks = new Set<ResonanceMark>()

  mark(mark: ResonanceMark): void {
    this.#marks.add(mark)
  }

  /** Marks whichever facet a completed stage corresponds to, if any. */
  markStage(stage: RitualStage): void {
    const mark = STAGE_MARKS[stage]
    if (mark) this.#marks.add(mark)
  }

  has(mark: ResonanceMark): boolean {
    return this.#marks.has(mark)
  }

  /** Marks earned so far, in canonical order. */
  get marked(): ResonanceMark[] {
    return RESONANCE_MARKS.filter((mark) => this.#marks.has(mark))
  }

  /** 0 to 1. Drives how aligned the ritual geometry appears. */
  get value(): number {
    return this.#marks.size / RESONANCE_MARKS.length
  }

  get complete(): boolean {
    return this.#marks.size === RESONANCE_MARKS.length
  }

  reset(): void {
    this.#marks.clear()
  }
}

/**
 * The ritual state machine.
 *
 * Every screen in ARCANUM is one of these states, and every move between
 * them goes through `transition`. Transitions are explicit and total: a
 * move that is not in the table is refused, and so is a move into the state
 * the machine is already in. That second rule is what stops a double tap,
 * a repeated timer, or a stray event from starting a stage twice.
 */

export const RITUAL_STATES = [
  'CHAMBER',
  'INTENSITY_SELECT',
  'OPENING',
  'BREATH',
  'INVOCATION',
  'SILENCE',
  'GROUNDING',
  'COMPLETION',
  'ARCHIVE',
  'SETTINGS',
] as const

export type RitualState = (typeof RITUAL_STATES)[number]

/** The stages of a running ritual, in the only order they may occur. */
export const RITUAL_STAGE_ORDER = [
  'OPENING',
  'BREATH',
  'INVOCATION',
  'SILENCE',
  'GROUNDING',
  'COMPLETION',
] as const

export type RitualStage = (typeof RITUAL_STAGE_ORDER)[number]

const STAGE_SET = new Set<string>(RITUAL_STAGE_ORDER)

/** True while a ritual is running, which is when navigation is hidden. */
export function isActiveRitualState(state: RitualState): state is RitualStage {
  return STAGE_SET.has(state)
}

/**
 * Legal moves. CHAMBER is reachable from everywhere, so a ritual can always
 * be abandoned. ARCHIVE and SETTINGS are reachable from anywhere a ritual is
 * not yet running — including the intensity choice, where the navigation is
 * still on screen and must not be inert.
 */
const TRANSITIONS: Record<RitualState, readonly RitualState[]> = {
  CHAMBER: ['INTENSITY_SELECT', 'ARCHIVE', 'SETTINGS'],
  INTENSITY_SELECT: ['OPENING', 'CHAMBER', 'ARCHIVE', 'SETTINGS'],
  OPENING: ['BREATH', 'CHAMBER'],
  BREATH: ['INVOCATION', 'CHAMBER'],
  INVOCATION: ['SILENCE', 'CHAMBER'],
  SILENCE: ['GROUNDING', 'CHAMBER'],
  GROUNDING: ['COMPLETION', 'CHAMBER'],
  COMPLETION: ['CHAMBER', 'ARCHIVE'],
  ARCHIVE: ['CHAMBER', 'SETTINGS'],
  SETTINGS: ['CHAMBER', 'ARCHIVE'],
}

export type StateListener = (state: RitualState, previous: RitualState) => void

export class RitualStateMachine {
  #state: RitualState
  #listeners = new Set<StateListener>()

  constructor(initial: RitualState = 'CHAMBER') {
    this.#state = initial
  }

  get state(): RitualState {
    return this.#state
  }

  can(next: RitualState): boolean {
    if (next === this.#state) return false
    return TRANSITIONS[this.#state].includes(next)
  }

  /** Returns false — silently, without notifying — if the move is illegal. */
  transition(next: RitualState): boolean {
    if (!this.can(next)) return false
    const previous = this.#state
    this.#state = next
    for (const listener of [...this.#listeners]) listener(next, previous)
    return true
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** Returns to the chamber unconditionally. Used on abort and on load. */
  reset(): void {
    if (this.#state === 'CHAMBER') return
    const previous = this.#state
    this.#state = 'CHAMBER'
    for (const listener of [...this.#listeners]) listener('CHAMBER', previous)
  }
}

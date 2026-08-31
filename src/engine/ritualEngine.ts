import { selectRitual } from '../rituals/index'
import {
  breathCycleSeconds,
  invocationLines,
  type BreathPattern,
  type RitualDefinition,
  type RitualIntensity,
  type RitualIntent,
} from '../rituals/types'

export type BreathPhaseKind = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

export interface BreathPhase {
  kind: BreathPhaseKind
  seconds: number
  /** Which cycle of the breath stage this phase belongs to, from 0. */
  cycleIndex: number
}

export interface SessionPlan {
  openingSeconds: number
  breathSeconds: number
  invocationSeconds: number
  silenceSeconds: number
  breathPhases: BreathPhase[]
  breathCycles: number
  invocationLines: string[]
  invocationLineSeconds: number[]
  /** Everything up to the grounding stage, which is not timed. */
  totalSeconds: number
}

interface IntensityShape {
  opening: number
  breathTarget: number
  secondsPerLine: number
  minCycles: number
}

/**
 * Time budgets per intensity. The silence duration is not here — it comes
 * from the ritual definition, so different passages can hold the room for
 * different lengths.
 */
const SHAPES: Record<RitualIntensity, IntensityShape> = {
  whisper: { opening: 6, breathTarget: 26, secondsPerLine: 2.6, minCycles: 2 },
  ritual: { opening: 9, breathTarget: 84, secondsPerLine: 5.2, minCycles: 5 },
  deep: { opening: 12, breathTarget: 140, secondsPerLine: 7.0, minCycles: 9 },
}

const PHASE_ORDER: BreathPhaseKind[] = ['inhale', 'holdIn', 'exhale', 'holdOut']

function cyclePhases(pattern: BreathPattern, cycleIndex: number): BreathPhase[] {
  return PHASE_ORDER.map((kind) => ({ kind, seconds: pattern[kind], cycleIndex })).filter(
    (phase) => phase.seconds > 0,
  )
}

/**
 * Builds the timing for one session.
 *
 * Breath cycles are always whole: the stage runs until the budget is met
 * rather than cutting a cycle short, so the last exhale always completes.
 */
export function planSession(ritual: RitualDefinition, intensity: RitualIntensity): SessionPlan {
  const shape = SHAPES[intensity]
  const patterns = ritual.breathPatterns

  const breathPhases: BreathPhase[] = []
  let breathSeconds = 0
  let cycleIndex = 0
  while (cycleIndex < shape.minCycles || breathSeconds < shape.breathTarget) {
    const pattern = patterns[Math.min(cycleIndex, patterns.length - 1)]
    breathPhases.push(...cyclePhases(pattern, cycleIndex))
    breathSeconds += breathCycleSeconds(pattern)
    cycleIndex += 1
    if (cycleIndex > 64) break
  }

  const lines = invocationLines(ritual)
  // Longer lines are held a little longer, so the passage reads at a
  // believable pace rather than a metronomic one.
  const averageLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length
  const invocationLineSeconds = lines.map((line) => {
    const ratio = averageLength > 0 ? line.length / averageLength : 1
    return Math.round(shape.secondsPerLine * (0.75 + 0.25 * ratio) * 10) / 10
  })
  const invocationSeconds = invocationLineSeconds.reduce((sum, seconds) => sum + seconds, 0)

  const silenceSeconds = ritual.silenceSeconds[intensity]

  return {
    openingSeconds: shape.opening,
    breathSeconds,
    invocationSeconds,
    silenceSeconds,
    breathPhases,
    breathCycles: cycleIndex,
    invocationLines: lines,
    invocationLineSeconds,
    totalSeconds: shape.opening + breathSeconds + invocationSeconds + silenceSeconds,
  }
}

export interface RitualSession {
  /** Unique per session. Also the sigil seed's stable half. */
  id: string
  ritual: RitualDefinition
  intent: RitualIntent
  intensity: RitualIntensity
  /** The one grounding action offered at the end of this session. */
  groundingAction: string
  /** Deterministic input to the sigil generator. */
  seed: string
  startedAt: number
  plan: SessionPlan
}

type SessionListener = (session: RitualSession | null) => void

let sessionCounter = 0

function makeSessionId(): string {
  sessionCounter += 1
  const random = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(4, '0')
  return `${Date.now().toString(36)}-${sessionCounter.toString(36)}-${random}`
}

/**
 * Owns the single active ritual session.
 *
 * The engine refuses to start a second session while one is running. That
 * is the invariant the whole ritual view depends on: one session, one set
 * of timers, one sigil.
 */
export class RitualEngine {
  #session: RitualSession | null = null
  #listeners = new Set<SessionListener>()
  #lastRitualByIntent = new Map<RitualIntent, string>()

  get session(): RitualSession | null {
    return this.#session
  }

  get active(): boolean {
    return this.#session !== null
  }

  begin(intent: RitualIntent, intensity: RitualIntensity): RitualSession {
    if (this.#session) {
      throw new Error('A ritual session is already active. End it before beginning another.')
    }
    const previous = this.#lastRitualByIntent.get(intent)
    const ritual = selectRitual(intent, { avoidIds: previous ? [previous] : [] })
    this.#lastRitualByIntent.set(intent, ritual.id)

    const groundingAction =
      ritual.groundingActions[Math.floor(Math.random() * ritual.groundingActions.length)]

    const id = makeSessionId()
    const session: RitualSession = {
      id,
      ritual,
      intent,
      intensity,
      groundingAction,
      seed: `${ritual.id}:${intensity}:${id}`,
      startedAt: Date.now(),
      plan: planSession(ritual, intensity),
    }
    this.#session = session
    this.#emit()
    return session
  }

  /** Ends the current session, whether completed or abandoned. */
  end(): void {
    if (!this.#session) return
    this.#session = null
    this.#emit()
  }

  subscribe(listener: SessionListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  #emit(): void {
    for (const listener of [...this.#listeners]) listener(this.#session)
  }
}

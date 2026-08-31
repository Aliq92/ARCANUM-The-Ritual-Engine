/**
 * Core content types for ARCANUM.
 *
 * Every ritual in the library is hand-authored. Nothing here is assembled
 * procedurally at runtime — the sigil geometry is generated, the language
 * never is.
 */

export const RITUAL_INTENTS = ['guard', 'still', 'mend', 'clear', 'seek', 'resolve'] as const
export type RitualIntent = (typeof RITUAL_INTENTS)[number]

export const RITUAL_INTENSITIES = ['whisper', 'ritual', 'deep'] as const
export type RitualIntensity = (typeof RITUAL_INTENSITIES)[number]

/** A single breath cycle, in seconds. A zero-length phase is simply skipped. */
export interface BreathPattern {
  /** Seconds drawing breath in. */
  inhale: number
  /** Seconds held at the top of the breath. */
  holdIn: number
  /** Seconds releasing breath. */
  exhale: number
  /** Seconds held at the bottom of the breath. */
  holdOut: number
}

export interface SilenceDurations {
  whisper: number
  ritual: number
  deep: number
}

export interface RitualDefinition {
  /** Stable, permanent identifier. Archive entries reference this. */
  id: string
  intent: RitualIntent
  title: string
  /** The ceremonial phrase shown during the OPENING stage. One sentence. */
  opening: string
  /** The authored invocation passage. Lines are separated by newlines. */
  invocation: string
  /** Breath cycles, used in order and looped to fill the breath stage. */
  breathPatterns: BreathPattern[]
  /** Concrete real-world actions. One is chosen per session. */
  groundingActions: string[]
  silenceSeconds: SilenceDurations
}

export function isRitualIntent(value: unknown): value is RitualIntent {
  return typeof value === 'string' && (RITUAL_INTENTS as readonly string[]).includes(value)
}

export function isRitualIntensity(value: unknown): value is RitualIntensity {
  return typeof value === 'string' && (RITUAL_INTENSITIES as readonly string[]).includes(value)
}

/** Total seconds of one full breath cycle. */
export function breathCycleSeconds(pattern: BreathPattern): number {
  return pattern.inhale + pattern.holdIn + pattern.exhale + pattern.holdOut
}

/** The invocation split into display lines, blank lines removed. */
export function invocationLines(ritual: RitualDefinition): string[] {
  return ritual.invocation
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

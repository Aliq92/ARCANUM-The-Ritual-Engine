import type { RitualIntent } from './types'

/**
 * Everything the rest of the application needs to know about an intent:
 * the words it shows, the light it casts, and the way its geometry moves.
 */
export interface IntentProfile {
  id: RitualIntent
  /** Displayed on the dial. */
  label: string
  /** One-line purpose, shown beneath the dial. */
  purpose: string
  /** Four keywords, shown as a restrained row. */
  keywords: [string, string, string, string]
  /** Hue for the intent's luminous accent, in degrees. */
  hue: number
  /** Accent saturation percentage. Kept low: this is not a neon interface. */
  saturation: number
  /** Accent lightness percentage. */
  lightness: number
  /** How the particle field behaves under this intent. */
  particleMode: 'inward' | 'slow' | 'converge' | 'dissolve' | 'orbit' | 'align'
  /** Base drone frequency in Hz for the ambient engine. */
  toneHz: number
  /** Ambient pulse period in seconds. */
  pulseSeconds: number
}

export const INTENT_PROFILES: Record<RitualIntent, IntentProfile> = {
  guard: {
    id: 'guard',
    label: 'GUARD',
    purpose: 'Protection, boundaries, courage, steadiness.',
    keywords: ['protection', 'boundaries', 'courage', 'steadiness'],
    hue: 12,
    saturation: 42,
    lightness: 62,
    particleMode: 'inward',
    toneHz: 58.27,
    pulseSeconds: 7.5,
  },
  still: {
    id: 'still',
    label: 'STILL',
    purpose: 'Calm, grounding, and the slowing of mental noise.',
    keywords: ['calm', 'grounding', 'quiet', 'presence'],
    hue: 205,
    saturation: 34,
    lightness: 66,
    particleMode: 'slow',
    toneHz: 49.0,
    pulseSeconds: 11,
  },
  mend: {
    id: 'mend',
    label: 'MEND',
    purpose: 'Recovery, patience, and the restoration of what was broken.',
    keywords: ['recovery', 'patience', 'healing', 'repair'],
    hue: 148,
    saturation: 30,
    lightness: 64,
    particleMode: 'converge',
    toneHz: 55.0,
    pulseSeconds: 9,
  },
  clear: {
    id: 'clear',
    label: 'CLEAR',
    purpose: 'Release of distraction, resentment, and mental clutter.',
    keywords: ['release', 'clutter', 'habit', 'space'],
    hue: 186,
    saturation: 28,
    lightness: 70,
    particleMode: 'dissolve',
    toneHz: 65.41,
    pulseSeconds: 8,
  },
  seek: {
    id: 'seek',
    label: 'SEEK',
    purpose: 'Insight, reflection, and perspective on difficult decisions.',
    keywords: ['insight', 'reflection', 'decision', 'perspective'],
    hue: 44,
    saturation: 40,
    lightness: 68,
    particleMode: 'orbit',
    toneHz: 61.74,
    pulseSeconds: 10,
  },
  resolve: {
    id: 'resolve',
    label: 'RESOLVE',
    purpose: 'Discipline, commitment, and finishing something difficult.',
    keywords: ['discipline', 'commitment', 'focus', 'finishing'],
    hue: 262,
    saturation: 32,
    lightness: 68,
    particleMode: 'align',
    toneHz: 73.42,
    pulseSeconds: 6,
  },
}

/** Dial order. Fixed, so the instrument always reads the same way. */
export const INTENT_ORDER: RitualIntent[] = ['guard', 'still', 'mend', 'clear', 'seek', 'resolve']

export function intentProfile(intent: RitualIntent): IntentProfile {
  return INTENT_PROFILES[intent]
}

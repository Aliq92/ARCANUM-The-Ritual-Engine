import { GUARD_RITUALS } from './guard'
import { STILL_RITUALS } from './still'
import { MEND_RITUALS } from './mend'
import { CLEAR_RITUALS } from './clear'
import { SEEK_RITUALS } from './seek'
import { RESOLVE_RITUALS } from './resolve'
import type { RitualDefinition, RitualIntent } from './types'

export const RITUALS_BY_INTENT: Record<RitualIntent, RitualDefinition[]> = {
  guard: GUARD_RITUALS,
  still: STILL_RITUALS,
  mend: MEND_RITUALS,
  clear: CLEAR_RITUALS,
  seek: SEEK_RITUALS,
  resolve: RESOLVE_RITUALS,
}

export const ALL_RITUALS: RitualDefinition[] = [
  ...GUARD_RITUALS,
  ...STILL_RITUALS,
  ...MEND_RITUALS,
  ...CLEAR_RITUALS,
  ...SEEK_RITUALS,
  ...RESOLVE_RITUALS,
]

const BY_ID = new Map(ALL_RITUALS.map((ritual) => [ritual.id, ritual]))

export function ritualsByIntent(intent: RitualIntent): RitualDefinition[] {
  return RITUALS_BY_INTENT[intent]
}

export function getRitualById(id: string): RitualDefinition | undefined {
  return BY_ID.get(id)
}

/**
 * Chooses a ritual for a session.
 *
 * `avoidIds` lets the caller steer away from recently completed rituals so
 * the same passage does not appear twice in a row. If everything has been
 * seen recently the full set is used again rather than returning nothing.
 */
export function selectRitual(
  intent: RitualIntent,
  options: { random?: () => number; avoidIds?: readonly string[] } = {},
): RitualDefinition {
  const random = options.random ?? Math.random
  const pool = ritualsByIntent(intent)
  const avoid = new Set(options.avoidIds ?? [])
  const fresh = pool.filter((ritual) => !avoid.has(ritual.id))
  const candidates = fresh.length > 0 ? fresh : pool
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))
  return candidates[index]
}

export * from './types'
export * from './intents'

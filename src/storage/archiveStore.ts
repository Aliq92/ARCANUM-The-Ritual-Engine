import { isRitualIntensity, isRitualIntent, type RitualIntensity, type RitualIntent } from '../rituals/types'
import { readJSON, removeRaw, writeJSON } from './safeStorage'

export const ARCHIVE_KEY = 'arcanum.archive.v1'

/** Old marks are kept, but not without limit. */
export const ARCHIVE_LIMIT = 240

export interface ArchiveEntry {
  id: string
  completedAt: number
  intent: RitualIntent
  intensity: RitualIntensity
  ritualId: string
  ritualTitle: string
  invocation: string
  groundingAction: string
  groundingAcknowledged: boolean
  seed: string
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0

/**
 * Validates one stored record. Anything that does not match is dropped
 * rather than repaired: a half-understood archive entry would render as a
 * broken sigil, which is worse than one fewer mark.
 */
function parseEntry(value: unknown): ArchiveEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (!isString(record.id)) return null
  if (typeof record.completedAt !== 'number' || !Number.isFinite(record.completedAt)) return null
  if (!isRitualIntent(record.intent)) return null
  if (!isRitualIntensity(record.intensity)) return null
  if (!isString(record.ritualId)) return null
  if (!isString(record.ritualTitle)) return null
  if (!isString(record.invocation)) return null
  if (!isString(record.groundingAction)) return null
  if (!isString(record.seed)) return null
  return {
    id: record.id,
    completedAt: record.completedAt,
    intent: record.intent,
    intensity: record.intensity,
    ritualId: record.ritualId,
    ritualTitle: record.ritualTitle,
    invocation: record.invocation,
    groundingAction: record.groundingAction,
    groundingAcknowledged: record.groundingAcknowledged === true,
    seed: record.seed,
  }
}

/** Newest first. Never throws; an unreadable archive reads as empty. */
export function loadArchive(): ArchiveEntry[] {
  const raw = readJSON(ARCHIVE_KEY)
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    removeRaw(ARCHIVE_KEY)
    return []
  }
  const entries: ArchiveEntry[] = []
  for (const item of raw) {
    const entry = parseEntry(item)
    if (entry) entries.push(entry)
  }
  entries.sort((a, b) => b.completedAt - a.completedAt)
  return entries.slice(0, ARCHIVE_LIMIT)
}

function persist(entries: ArchiveEntry[]): void {
  writeJSON(ARCHIVE_KEY, entries.slice(0, ARCHIVE_LIMIT))
}

export function saveArchiveEntry(entry: ArchiveEntry): ArchiveEntry[] {
  const entries = [entry, ...loadArchive().filter((existing) => existing.id !== entry.id)]
  entries.sort((a, b) => b.completedAt - a.completedAt)
  const capped = entries.slice(0, ARCHIVE_LIMIT)
  persist(capped)
  return capped
}

export function removeArchiveEntry(id: string): ArchiveEntry[] {
  const entries = loadArchive().filter((entry) => entry.id !== id)
  persist(entries)
  return entries
}

export function clearArchive(): void {
  removeRaw(ARCHIVE_KEY)
}

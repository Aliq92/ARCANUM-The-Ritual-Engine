import { readJSON, removeRaw, writeJSON } from './safeStorage'

export const SETTINGS_KEY = 'arcanum.settings.v1'

export type MotionSetting = 'full' | 'reduced'

export interface Settings {
  sound: boolean
  haptics: boolean
  motion: MotionSetting
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  motion: 'full',
}

/**
 * Reads settings field by field. A single corrupt value falls back to its
 * default without discarding the others.
 */
export function loadSettings(): Settings {
  const raw = readJSON(SETTINGS_KEY)
  if (raw === undefined) return { ...DEFAULT_SETTINGS }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    removeRaw(SETTINGS_KEY)
    return { ...DEFAULT_SETTINGS }
  }
  const record = raw as Record<string, unknown>
  return {
    sound: typeof record.sound === 'boolean' ? record.sound : DEFAULT_SETTINGS.sound,
    haptics: typeof record.haptics === 'boolean' ? record.haptics : DEFAULT_SETTINGS.haptics,
    motion: record.motion === 'reduced' || record.motion === 'full' ? record.motion : DEFAULT_SETTINGS.motion,
  }
}

export function saveSettings(settings: Settings): void {
  writeJSON(SETTINGS_KEY, settings)
}

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ARCHIVE_KEY,
  loadArchive,
  saveArchiveEntry,
  clearArchive,
  removeArchiveEntry,
  type ArchiveEntry,
} from '../src/storage/archiveStore'
import {
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../src/storage/settingsStore'

const entry = (overrides: Partial<ArchiveEntry> = {}): ArchiveEntry => ({
  id: 'entry-1',
  completedAt: 1_700_000_000_000,
  intent: 'guard',
  intensity: 'ritual',
  ritualId: 'guard-standing-line',
  ritualTitle: 'The Standing Line',
  invocation: 'Here is the line, and I am the one who draws it.',
  groundingAction: 'Sit still for sixty seconds.',
  groundingAcknowledged: true,
  seed: 'guard-standing-line:ritual:abc',
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
})

describe('archiveStore', () => {
  it('round-trips an entry', () => {
    saveArchiveEntry(entry())
    const loaded = loadArchive()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual(entry())
  })

  it('returns an empty archive when nothing is stored', () => {
    expect(loadArchive()).toEqual([])
  })

  it('keeps the newest entry first', () => {
    saveArchiveEntry(entry({ id: 'a', completedAt: 1000 }))
    saveArchiveEntry(entry({ id: 'b', completedAt: 3000 }))
    saveArchiveEntry(entry({ id: 'c', completedAt: 2000 }))
    expect(loadArchive().map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('removes one entry', () => {
    saveArchiveEntry(entry({ id: 'a' }))
    saveArchiveEntry(entry({ id: 'b' }))
    removeArchiveEntry('a')
    expect(loadArchive().map((e) => e.id)).toEqual(['b'])
  })

  it('clears the archive', () => {
    saveArchiveEntry(entry())
    clearArchive()
    expect(loadArchive()).toEqual([])
  })

  it('recovers from malformed JSON without throwing', () => {
    localStorage.setItem(ARCHIVE_KEY, '{ this is not json')
    expect(loadArchive()).toEqual([])
    expect(() => saveArchiveEntry(entry())).not.toThrow()
    expect(loadArchive()).toHaveLength(1)
  })

  it('drops entries that fail validation but keeps the valid ones', () => {
    localStorage.setItem(
      ARCHIVE_KEY,
      JSON.stringify([entry({ id: 'good' }), { id: 'bad' }, null, 42, { ...entry(), intent: 'wrath' }]),
    )
    const loaded = loadArchive()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('good')
  })

  it('resets a stored value that is not an array', () => {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify({ entries: [] }))
    expect(loadArchive()).toEqual([])
  })

  it('caps the archive so storage cannot grow without bound', () => {
    for (let i = 0; i < 260; i++) {
      saveArchiveEntry(entry({ id: `e${i}`, completedAt: 1000 + i }))
    }
    const loaded = loadArchive()
    expect(loaded.length).toBeLessThanOrEqual(240)
    expect(loaded[0].id).toBe('e259')
  })

  it('survives storage being unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => saveArchiveEntry(entry())).not.toThrow()
    setItem.mockRestore()

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(loadArchive()).toEqual([])
    getItem.mockRestore()
  })
})

describe('settingsStore', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips settings', () => {
    const settings: Settings = { sound: false, haptics: false, motion: 'reduced' }
    saveSettings(settings)
    expect(loadSettings()).toEqual(settings)
  })

  it('repairs malformed JSON', () => {
    localStorage.setItem(SETTINGS_KEY, 'not json at all')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid fields and replaces invalid ones with defaults', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sound: false, motion: 'sideways', haptics: 'yes' }))
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false })
  })

  it('ignores a stored value that is not an object', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify([1, 2, 3]))
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('survives storage being unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    getItem.mockRestore()

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow()
    setItem.mockRestore()
  })
})

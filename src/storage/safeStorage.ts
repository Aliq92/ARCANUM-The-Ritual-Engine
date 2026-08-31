/**
 * A localStorage wrapper that never throws.
 *
 * Storage can be missing (server-side render, very old browser), blocked
 * (Safari private browsing, third-party cookie policies) or full. In every
 * one of those cases the ritual itself must still run — the archive is a
 * convenience, not a dependency.
 */

function backing(): Storage | null {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    return storage
  } catch {
    return null
  }
}

export function readRaw(key: string): string | null {
  try {
    return backing()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeRaw(key: string, value: string): boolean {
  try {
    backing()?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeRaw(key: string): void {
  try {
    backing()?.removeItem(key)
  } catch {
    /* nothing to do: the value is already unreachable */
  }
}

/** Parses stored JSON, discarding anything unreadable. */
export function readJSON(key: string): unknown {
  const raw = readRaw(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    removeRaw(key)
    return undefined
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    return writeRaw(key, JSON.stringify(value))
  } catch {
    return false
  }
}

export function storageAvailable(): boolean {
  const probe = '__arcanum_probe__'
  if (!writeRaw(probe, '1')) return false
  removeRaw(probe)
  return true
}

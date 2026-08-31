import type { IntentProfile } from '../rituals/intents'
import { AmbientEngine } from './ambientEngine'

export type BreathPhaseKind = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

/**
 * The audio and haptic voice of the ritual.
 *
 * Both channels are optional and independently switchable, and both fail
 * quietly: a device without a vibration motor, or a browser that refuses an
 * AudioContext, simply gets a silent ritual rather than an error.
 */
export class RitualAudio {
  readonly ambient = new AmbientEngine()
  #haptics = true
  #profile: IntentProfile | null = null

  setSoundEnabled(enabled: boolean): void {
    this.ambient.setEnabled(enabled)
  }

  setHapticsEnabled(enabled: boolean): void {
    this.#haptics = enabled
  }

  /** Call from a user gesture before the ritual needs sound. */
  async awaken(): Promise<void> {
    await this.ambient.start()
  }

  setIntent(profile: IntentProfile): void {
    this.#profile = profile
    this.ambient.setIntent(profile)
  }

  setLevel(level: number): void {
    this.ambient.setLevel(level)
  }

  /** navigator.vibrate is unsupported on iOS and throws on some Androids. */
  vibrate(pattern: number | number[]): void {
    if (!this.#haptics) return
    try {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
      navigator.vibrate(pattern)
    } catch {
      /* no motor, or the page is not permitted to use it */
    }
  }

  /** The click of the dial seating on a mark. */
  detent(): void {
    this.vibrate(8)
    this.ambient.tone((this.#profile?.toneHz ?? 55) * 16, 0.16, 0.022)
  }

  breath(phase: BreathPhaseKind, profile: IntentProfile): void {
    const base = profile.toneHz * 6
    switch (phase) {
      case 'inhale':
        this.vibrate(18)
        this.ambient.tone(base, 1.1, 0.045)
        break
      case 'exhale':
        this.vibrate([10, 40, 10])
        this.ambient.tone(base * 0.75, 1.5, 0.04)
        break
      case 'holdIn':
      case 'holdOut':
        this.vibrate(6)
        break
    }
  }

  stageChange(): void {
    this.vibrate([12, 60, 12])
    this.ambient.tone((this.#profile?.toneHz ?? 55) * 6, 1.4, 0.03)
  }

  completion(): void {
    this.vibrate([16, 90, 16, 90, 40])
    this.ambient.chime()
  }

  async dispose(): Promise<void> {
    await this.ambient.dispose()
  }
}

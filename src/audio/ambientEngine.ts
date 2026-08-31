import type { IntentProfile } from '../rituals/intents'

/**
 * Procedural ambience.
 *
 * Everything is synthesised — there are no audio files to download. Three
 * quiet layers: a low drone with a fifth above it, a band-passed noise bed,
 * and a distant metallic partial, with a slow pulse riding the drone's gain.
 * Each intent moves the pitch, the filter and the pulse rate.
 *
 * The context is created only on a genuine user gesture, which is what
 * browser autoplay policy requires. If anything here fails, the instrument
 * simply stays silent.
 */

const MASTER_LEVEL = 0.16

export class AmbientEngine {
  #context: AudioContext | null = null
  #master: GainNode | null = null
  #filter: BiquadFilterNode | null = null
  #voices: OscillatorNode[] = []
  #noise: AudioBufferSourceNode | null = null
  #pulse: OscillatorNode | null = null
  #profile: IntentProfile | null = null
  #enabled = true
  #started = false
  #failed = false

  get running(): boolean {
    return this.#started && this.#context?.state === 'running'
  }

  /** Must be called from inside a user gesture. Safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.#failed || !this.#enabled) return
    try {
      if (!this.#context) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) {
          this.#failed = true
          return
        }
        this.#context = new Ctor()
        this.#build()
      }
      if (this.#context.state === 'suspended') await this.#context.resume()
      if (!this.#started) {
        this.#started = true
        this.#rampMaster(MASTER_LEVEL, 4)
      }
    } catch {
      // No audio available. The ritual does not depend on it.
      this.#failed = true
    }
  }

  #build(): void {
    const context = this.#context
    if (!context) return

    const master = context.createGain()
    master.gain.value = 0
    master.connect(context.destination)

    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.Q.value = 0.6
    filter.connect(master)

    const droneGain = context.createGain()
    droneGain.gain.value = 0.5
    droneGain.connect(filter)

    const base = this.#profile?.toneHz ?? 55

    // Drone: root, a detuned root for movement, and a fifth above.
    for (const [frequency, type, level] of [
      [base, 'sine', 0.5],
      [base * 1.005, 'sine', 0.32],
      [base * 1.5, 'triangle', 0.12],
      [base * 4, 'sine', 0.035],
    ] as const) {
      const oscillator = context.createOscillator()
      oscillator.type = type
      oscillator.frequency.value = frequency
      const gain = context.createGain()
      gain.gain.value = level
      oscillator.connect(gain).connect(droneGain)
      oscillator.start()
      this.#voices.push(oscillator)
    }

    // A slow swell across the drone, at the intent's own rate.
    const pulse = context.createOscillator()
    pulse.type = 'sine'
    pulse.frequency.value = 1 / (this.#profile?.pulseSeconds ?? 9)
    const pulseDepth = context.createGain()
    pulseDepth.gain.value = 0.18
    pulse.connect(pulseDepth).connect(droneGain.gain)
    pulse.start()
    this.#pulse = pulse

    // Noise bed: two seconds of filtered noise, looped.
    const frames = context.sampleRate * 2
    const buffer = context.createBuffer(1, frames, context.sampleRate)
    const channel = buffer.getChannelData(0)
    let running = 0
    for (let i = 0; i < frames; i++) {
      // A simple one-pole low pass over white noise: closer to a breath than a hiss.
      running = running * 0.96 + (Math.random() * 2 - 1) * 0.04
      channel[i] = running
    }
    const noise = context.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const noiseFilter = context.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 620
    noiseFilter.Q.value = 0.7
    const noiseGain = context.createGain()
    noiseGain.gain.value = 0.5
    noise.connect(noiseFilter).connect(noiseGain).connect(master)
    noise.start()
    this.#noise = noise

    this.#master = master
    this.#filter = filter
    if (this.#profile) this.setIntent(this.#profile)
  }

  #rampMaster(value: number, seconds: number): void {
    const context = this.#context
    const master = this.#master
    if (!context || !master) return
    const now = context.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(value, now + seconds)
  }

  setIntent(profile: IntentProfile): void {
    this.#profile = profile
    const context = this.#context
    if (!context || this.#voices.length === 0) return
    const now = context.currentTime
    const ratios = [1, 1.005, 1.5, 4]
    // Glide rather than jump: changing intent should feel like a dial turning.
    for (const [index, voice] of this.#voices.entries()) {
      voice.frequency.cancelScheduledValues(now)
      voice.frequency.setValueAtTime(voice.frequency.value, now)
      voice.frequency.exponentialRampToValueAtTime(
        Math.max(20, profile.toneHz * (ratios[index] ?? 1)),
        now + 1.6,
      )
    }
    if (this.#pulse) {
      this.#pulse.frequency.cancelScheduledValues(now)
      this.#pulse.frequency.setValueAtTime(this.#pulse.frequency.value, now)
      this.#pulse.frequency.linearRampToValueAtTime(1 / profile.pulseSeconds, now + 1.6)
    }
    if (this.#filter) {
      // Brighter intents open the filter a little.
      const cutoff = 300 + profile.lightness * 4 + profile.saturation * 2
      this.#filter.frequency.cancelScheduledValues(now)
      this.#filter.frequency.setValueAtTime(this.#filter.frequency.value, now)
      this.#filter.frequency.linearRampToValueAtTime(cutoff, now + 1.6)
    }
  }

  /** 0 to 1. Silence drops this near the floor rather than cutting out. */
  setLevel(level: number): void {
    if (!this.#started) return
    this.#rampMaster(MASTER_LEVEL * Math.max(0, Math.min(1, level)), 2.5)
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled
    if (!enabled) {
      this.#rampMaster(0, 0.6)
      this.#started = false
      void this.#context?.suspend().catch(() => undefined)
    }
  }

  get enabled(): boolean {
    return this.#enabled
  }

  /** A short, soft tone. Used for breath phases and stage changes. */
  tone(frequency: number, seconds = 0.9, level = 0.06): void {
    const context = this.#context
    const master = this.#master
    if (!context || !master || !this.#started || !this.#enabled) return
    try {
      const now = context.currentTime
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const gain = context.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(level, now + Math.min(0.25, seconds * 0.3))
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds)
      oscillator.connect(gain).connect(master)
      oscillator.start(now)
      oscillator.stop(now + seconds + 0.05)
    } catch {
      /* a missed cue is not worth interrupting a ritual for */
    }
  }

  /** Two quiet partials, a fifth apart, with a long decay. */
  chime(): void {
    const base = (this.#profile?.toneHz ?? 55) * 8
    this.tone(base, 2.6, 0.05)
    this.tone(base * 1.5, 3.4, 0.032)
  }

  async dispose(): Promise<void> {
    try {
      this.#rampMaster(0, 0.3)
      for (const voice of this.#voices) voice.stop()
      this.#noise?.stop()
      this.#pulse?.stop()
      await this.#context?.close()
    } catch {
      /* already gone */
    }
    this.#voices = []
    this.#context = null
    this.#master = null
    this.#started = false
  }
}

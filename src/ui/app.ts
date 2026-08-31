import { RitualEngine, type RitualSession } from '../engine/ritualEngine'
import {
  RitualStateMachine,
  isActiveRitualState,
  type RitualStage,
  type RitualState,
} from '../engine/ritualState'
import { INTENT_ORDER, intentProfile } from '../rituals/intents'
import type { RitualIntensity, RitualIntent } from '../rituals/types'
import { RitualAudio } from '../audio/ritualAudio'
import { createParticleField, type ParticleField } from '../visuals/particleField'
import { saveArchiveEntry, type ArchiveEntry } from '../storage/archiveStore'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../storage/settingsStore'
import { createChamberView } from './chamber'
import { createIntensityView } from './intensitySelector'
import { createRitualView, type RitualView } from './ritualView'
import { createArchiveView } from './archiveView'
import { createSettingsView } from './settingsView'
import type { View } from './dom'

/** How loud and how lively the field is in each stage. */
const STAGE_ENERGY: Record<RitualStage, number> = {
  OPENING: 0.7,
  BREATH: 1,
  INVOCATION: 0.8,
  SILENCE: 0.3,
  GROUNDING: 0.6,
  COMPLETION: 0.85,
}

export class ArcanumApp {
  readonly machine = new RitualStateMachine()
  readonly engine = new RitualEngine()
  readonly audio = new RitualAudio()

  #stage: HTMLElement
  #nav: HTMLElement
  #live: HTMLElement
  #field: ParticleField
  #settings: Settings = { ...DEFAULT_SETTINGS }
  #intent: RitualIntent = 'guard'
  #view: View | null = null
  #ritualView: RitualView | null = null
  #motionQuery: MediaQueryList | null = null
  #audioAwoken = false

  constructor(root: { stage: HTMLElement; nav: HTMLElement; live: HTMLElement; canvas: HTMLCanvasElement }) {
    this.#stage = root.stage
    this.#nav = root.nav
    this.#live = root.live
    this.#field = createParticleField(root.canvas)

    this.#settings = loadSettings()
    this.#intent = INTENT_ORDER[Math.floor(Math.random() * INTENT_ORDER.length)]

    this.#watchMotionPreference()
    this.#applySettings()
    this.#applyIntent(this.#intent)

    this.#nav.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-nav]')
      if (!button?.dataset.nav) return
      void this.#wakeAudio()
      const destination: RitualState =
        button.dataset.nav === 'archive' ? 'ARCHIVE' : button.dataset.nav === 'settings' ? 'SETTINGS' : 'CHAMBER'
      this.go(destination)
    })

    this.machine.subscribe((state) => this.#onState(state))

    // A refresh mid-ritual returns to the chamber. Restoring a half-finished
    // ritual would be worse than starting again cleanly.
    this.#renderState('CHAMBER')
  }

  /* ---------------------------------------------------------------- */
  /* Settings and environment                                          */
  /* ---------------------------------------------------------------- */

  get settings(): Settings {
    return this.#settings
  }

  reducedMotion(): boolean {
    return this.#settings.motion === 'reduced' || (this.#motionQuery?.matches ?? false)
  }

  #watchMotionPreference(): void {
    try {
      this.#motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.#motionQuery.addEventListener('change', () => this.#applySettings())
    } catch {
      this.#motionQuery = null
    }
  }

  updateSettings(patch: Partial<Settings>): void {
    this.#settings = { ...this.#settings, ...patch }
    saveSettings(this.#settings)
    // Reached from a control the user just pressed, so audio may start here.
    this.#applySettings({ fromGesture: true })
  }

  #applySettings(options: { fromGesture?: boolean } = {}): void {
    const reduced = this.reducedMotion()
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
    this.#field.setReducedMotion(reduced)
    this.audio.setSoundEnabled(this.#settings.sound)
    this.audio.setHapticsEnabled(this.#settings.haptics)
    // No AudioContext is constructed on load: it is created by the first
    // genuine interaction, which is what autoplay policy actually requires.
    if (options.fromGesture && this.#settings.sound) void this.#wakeAudio()
  }

  /** Audio may only be created inside a gesture; every entry point tries. */
  async #wakeAudio(): Promise<void> {
    if (!this.#settings.sound) return
    this.audio.setIntent(intentProfile(this.#intent))
    await this.audio.awaken()
    this.#audioAwoken = true
  }

  #applyIntent(intent: RitualIntent): void {
    this.#intent = intent
    const profile = intentProfile(intent)
    const root = document.documentElement
    root.dataset.intent = intent
    root.style.setProperty('--accent-h', String(profile.hue))
    root.style.setProperty('--accent-s', `${profile.saturation}%`)
    root.style.setProperty('--accent-l', `${profile.lightness}%`)
    this.#field.setIntent(profile)
    if (this.#audioAwoken) this.audio.setIntent(profile)
  }

  announce(message: string): void {
    this.#live.textContent = message
  }

  /* ---------------------------------------------------------------- */
  /* Navigation                                                        */
  /* ---------------------------------------------------------------- */

  go(state: RitualState): void {
    this.machine.transition(state)
  }

  #onState(state: RitualState): void {
    document.body.dataset.ritualActive = String(isActiveRitualState(state))
    this.#syncNav(state)

    if (isActiveRitualState(state)) {
      this.#field.setEnergy(STAGE_ENERGY[state])
      this.audio.setLevel(STAGE_ENERGY[state])
      // The ritual view stays mounted for the whole ritual; only its stage
      // changes, so the core symbol is never torn down mid-ceremony.
      if (state === 'OPENING' || !this.#ritualView) {
        this.#renderState(state)
      } else {
        this.#ritualView.showStage(state)
      }
      return
    }

    this.#field.setEnergy(1)
    this.audio.setLevel(1)
    this.#ritualView = null
    if (this.engine.active) this.engine.end()
    this.#renderState(state)
  }

  #syncNav(state: RitualState): void {
    const active = state === 'ARCHIVE' ? 'archive' : state === 'SETTINGS' ? 'settings' : 'chamber'
    for (const button of this.#nav.querySelectorAll<HTMLElement>('[data-nav]')) {
      if (button.dataset.nav === active) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
  }

  /* ---------------------------------------------------------------- */
  /* Views                                                             */
  /* ---------------------------------------------------------------- */

  #renderState(state: RitualState): void {
    const view = this.#buildView(state)
    if (!view) return
    this.#mount(view)
  }

  #mount(view: View): void {
    const previous = this.#view
    if (previous) {
      previous.element.classList.add('view--leaving')
      const remove = () => {
        previous.element.remove()
        previous.destroy?.()
      }
      // Leave through the transition if there is one; otherwise immediately.
      if (this.reducedMotion()) remove()
      else window.setTimeout(remove, 260)
    }
    this.#view = view
    this.#stage.append(view.element)
    view.enter?.()
  }

  #buildView(state: RitualState): View | null {
    switch (state) {
      case 'CHAMBER':
        return createChamberView({
          initialIntent: this.#intent,
          reducedMotion: () => this.reducedMotion(),
          onIntentChange: (intent) => this.#applyIntent(intent),
          onDetent: () => this.audio.detent(),
          onBegin: () => {
            void this.#wakeAudio()
            this.go('INTENSITY_SELECT')
          },
        })

      case 'INTENSITY_SELECT':
        return createIntensityView({
          onSelect: (intensity) => this.#beginRitual(intensity),
          onCancel: () => this.go('CHAMBER'),
        })

      case 'OPENING':
        return this.#buildRitualView()

      case 'ARCHIVE':
        return createArchiveView({ onOpenChamber: () => this.go('CHAMBER') })

      case 'SETTINGS':
        return createSettingsView({
          settings: this.#settings,
          hapticsSupported: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
          onChange: (patch) => this.updateSettings(patch),
          onArchiveCleared: () => this.announce('Archive cleared.'),
        })

      default:
        return null
    }
  }

  #beginRitual(intensity: RitualIntensity): void {
    void this.#wakeAudio()
    if (this.engine.active) this.engine.end()
    this.engine.begin(this.#intent, intensity)
    this.go('OPENING')
  }

  #buildRitualView(): View | null {
    const session = this.engine.session
    if (!session) {
      this.go('CHAMBER')
      return null
    }
    const view = createRitualView({
      session,
      reducedMotion: () => this.reducedMotion(),
      advance: (stage) => this.go(stage),
      abandon: () => this.go('CHAMBER'),
      announce: (message) => this.announce(message),
      onResonance: (value) => document.documentElement.style.setProperty('--resonance', value.toFixed(3)),
      onStageEnter: () => this.audio.stageChange(),
      onBreathPhase: (kind) => this.audio.breath(kind, intentProfile(session.intent)),
      onComplete: (acknowledged) => this.#recordCompletion(session, acknowledged),
      onArchive: () => this.go('ARCHIVE'),
    })
    this.#ritualView = view
    // The first stage is driven here so the view and the machine agree.
    queueMicrotask(() => view.showStage('OPENING'))
    return view
  }

  #recordCompletion(session: RitualSession, acknowledged: boolean): void {
    this.audio.completion()
    const entry: ArchiveEntry = {
      id: session.id,
      completedAt: Date.now(),
      intent: session.intent,
      intensity: session.intensity,
      ritualId: session.ritual.id,
      ritualTitle: session.ritual.title,
      invocation: session.ritual.invocation,
      groundingAction: session.groundingAction,
      groundingAcknowledged: acknowledged,
      seed: session.seed,
    }
    saveArchiveEntry(entry)
  }

  destroy(): void {
    this.#view?.destroy?.()
    this.#field.destroy()
    void this.audio.dispose()
  }
}

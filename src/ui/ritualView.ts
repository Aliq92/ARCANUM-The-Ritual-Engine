import type { RitualSession } from '../engine/ritualEngine'
import { Resonance, RESONANCE_MARKS } from '../engine/resonance'
import { TimerGroup } from '../engine/timers'
import type { RitualStage } from '../engine/ritualState'
import { intentProfile } from '../rituals/intents'
import { createRitualGeometry } from '../visuals/ritualGeometry'
import { createGroundingPanel } from './groundingView'
import { createCompletionPanel } from './completionView'
import { h, type View } from './dom'

export interface RitualViewHandlers {
  session: RitualSession
  /** Requests the next stage. The state machine has the final say. */
  advance(stage: RitualStage): void
  abandon(): void
  onResonance(value: number): void
  onStageEnter(stage: RitualStage): void
  onBreathPhase(kind: 'inhale' | 'holdIn' | 'exhale' | 'holdOut'): void
  onComplete(acknowledged: boolean): void
  onArchive(): void
  announce(message: string): void
  reducedMotion(): boolean
}

export interface RitualView extends View {
  /** Driven by the state machine; the view never changes stage on its own. */
  showStage(stage: RitualStage): void
}

const PHASE_LABEL: Record<string, string> = {
  inhale: 'Breathe in',
  holdIn: 'Hold',
  exhale: 'Breathe out',
  holdOut: 'Hold',
}

/** The circumference of the progress ring, r = 94 in a 200 viewBox. */
const RING_CIRCUMFERENCE = 2 * Math.PI * 94

/**
 * The active ritual.
 *
 * One view spans OPENING through COMPLETION. The core symbol stays mounted
 * the whole way, so the instrument never cuts between stages — only the
 * content beneath it changes, and the atmosphere follows `data-stage`.
 *
 * Every timer belongs to a single TimerGroup that is cleared on entry to each
 * stage, which is what guarantees a stage can never be running twice.
 */
export function createRitualView(handlers: RitualViewHandlers): RitualView {
  const { session } = handlers
  const { plan } = session
  const timers = new TimerGroup()
  const resonance = new Resonance()

  const geometry = createRitualGeometry()
  const geometryHolder = h('div', { class: 'rite__geometry' })
  geometryHolder.append(geometry)

  const progress = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  progress.setAttribute('class', 'rite__progress')
  progress.setAttribute('viewBox', '0 0 200 200')
  progress.setAttribute('aria-hidden', 'true')
  // A track behind the sweep, plus graduations, so the ritual is read against
  // the same frame as the chamber dial rather than floating unbounded.
  progress.innerHTML = `
    <circle class="rite__progress-track" cx="100" cy="100" r="94" />
    <circle class="rite__progress-graduations" cx="100" cy="100" r="86" />
    <circle class="rite__progress-value" cx="100" cy="100" r="94"
      style="--circumference:${RING_CIRCUMFERENCE.toFixed(2)}" />`
  const progressValue = progress.querySelector<SVGCircleElement>('.rite__progress-value')!

  const core = h('div', { class: 'rite__core' }, [progress, geometryHolder])
  const content = h('div', { class: 'rite__content' })

  const marks = h(
    'ul',
    { class: 'rite__resonance', 'aria-hidden': 'true' },
    RESONANCE_MARKS.map((mark) => h('li', { class: 'rite__mark', 'data-mark': mark })),
  )

  const end = h(
    'button',
    { class: 'rite__end', type: 'button', 'aria-label': 'End this ritual and return to the chamber' },
    ['End'],
  )
  end.addEventListener('click', () => handlers.abandon())

  const element = h('section', { class: 'view rite', 'aria-label': 'Ritual in progress' }, [
    core,
    content,
    marks,
    end,
  ])

  let acknowledged = false
  let destroyed = false

  /* -------------------------------------------------------------- */
  /* Shared stage mechanics                                          */
  /* -------------------------------------------------------------- */

  /** Sweeps the ring across the stage. One thin line, never a countdown. */
  const runProgress = (seconds: number) => {
    progressValue.style.transition = 'none'
    progressValue.style.setProperty('--progress', '0')
    // Force a style flush so the reset is not coalesced with the sweep.
    void progressValue.getBoundingClientRect()
    progressValue.style.transition = `stroke-dashoffset ${seconds}s linear`
    progressValue.style.setProperty('--progress', '1')
  }

  const clearProgress = () => {
    progressValue.style.transition = 'none'
    progressValue.style.setProperty('--progress', '0')
  }

  const setBreath = (scale: number, glow: number, seconds: number) => {
    element.style.setProperty('--breath-duration', `${seconds}s`)
    element.style.setProperty('--breath-scale', String(scale))
    element.style.setProperty('--breath-glow', String(glow))
  }

  const markResonance = (stage: RitualStage) => {
    resonance.markStage(stage)
    for (const mark of resonance.marked) {
      marks.querySelector(`[data-mark="${mark}"]`)?.setAttribute('data-lit', 'true')
    }
    handlers.onResonance(resonance.value)
  }

  const setContent = (node: Node | null) => {
    content.replaceChildren(...(node ? [node] : []))
  }

  /* -------------------------------------------------------------- */
  /* Stages                                                          */
  /* -------------------------------------------------------------- */

  const runOpening = () => {
    const phrase = h('p', { class: 'rite__opening' }, [session.ritual.opening])
    const panel = h(
      'div',
      {
        class: 'rite__panel rite__panel--opening',
        role: 'button',
        tabindex: '0',
        'aria-label': `${session.ritual.opening} Continue to the breath.`,
      },
      [phrase, h('p', { class: 'rite__nudge' }, ['Touch to continue'])],
    )
    // The opening is the one stage a person may move through at their own
    // pace, by pointer or by key. Everything after it is timed.
    panel.addEventListener('click', () => handlers.advance('BREATH'))
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handlers.advance('BREATH')
      }
    })
    setContent(panel)
    handlers.announce(session.ritual.opening)
    runProgress(plan.openingSeconds)
    timers.timeout(() => handlers.advance('BREATH'), plan.openingSeconds * 1000)
  }

  const runBreath = () => {
    const label = h('p', { class: 'rite__phase' }, ['Breathe in'])
    const count = h('p', { class: 'rite__count' })
    setContent(h('div', { class: 'rite__panel rite__panel--breath' }, [label, count]))
    handlers.announce('Follow the breath.')
    runProgress(plan.breathSeconds)

    const phases = plan.breathPhases
    const runPhase = (index: number) => {
      if (destroyed) return
      if (index >= phases.length) {
        handlers.advance('INVOCATION')
        return
      }
      const phase = phases[index]
      label.textContent = PHASE_LABEL[phase.kind] ?? ''
      count.textContent = `${phase.cycleIndex + 1} of ${plan.breathCycles}`
      element.dataset.breath = phase.kind

      // The geometry expands and holds with the breath; the transition
      // duration is exactly the phase, so the movement is the instruction.
      switch (phase.kind) {
        case 'inhale':
          setBreath(1.34, 0.9, phase.seconds)
          break
        case 'holdIn':
          setBreath(1.34, 0.9, phase.seconds)
          break
        case 'exhale':
          setBreath(0.8, 0.24, phase.seconds)
          break
        case 'holdOut':
          setBreath(0.8, 0.24, phase.seconds)
          break
      }
      handlers.onBreathPhase(phase.kind)
      timers.timeout(() => runPhase(index + 1), phase.seconds * 1000)
    }
    runPhase(0)
  }

  const runInvocation = () => {
    setBreath(1, 0.4, 2.4)
    delete element.dataset.breath
    const line = h('p', { class: 'rite__line' })
    setContent(h('div', { class: 'rite__panel rite__panel--invocation' }, [line]))
    runProgress(plan.invocationSeconds)

    // One line at a time. The passage is never dumped on the screen at once.
    const showLine = (index: number) => {
      if (destroyed) return
      if (index >= plan.invocationLines.length) {
        handlers.advance('SILENCE')
        return
      }
      const text = plan.invocationLines[index]
      line.dataset.state = 'leaving'
      timers.timeout(() => {
        line.textContent = text
        line.dataset.state = 'present'
        handlers.announce(text)
      }, 240)
      timers.timeout(() => showLine(index + 1), plan.invocationLineSeconds[index] * 1000)
    }
    showLine(0)
  }

  const runSilence = () => {
    // Text and controls withdraw entirely. Only the geometry remains.
    setContent(null)
    setBreath(1.05, 0.16, 6)
    handlers.announce('Silence.')
    runProgress(plan.silenceSeconds)
    timers.timeout(() => handlers.advance('GROUNDING'), plan.silenceSeconds * 1000)
  }

  const runGrounding = () => {
    clearProgress()
    setBreath(1, 0.35, 2)
    const finish = (accepted: boolean) => {
      acknowledged = accepted
      handlers.advance('COMPLETION')
    }
    setContent(
      createGroundingPanel({
        action: session.groundingAction,
        onAccept: () => finish(true),
        onDefer: () => finish(false),
      }),
    )
    handlers.announce(session.groundingAction)
  }

  const runCompletion = () => {
    clearProgress()
    setBreath(1, 0.5, 1.6)
    const { sigil, panel } = createCompletionPanel({
      session,
      acknowledged,
      onReturn: () => handlers.abandon(),
      onArchive: () => handlers.onArchive(),
    })
    // The live geometry gives way to the finished mark in the same place.
    geometryHolder.dataset.state = 'retired'
    core.append(sigil)
    setContent(panel)
    handlers.onComplete(acknowledged)
    handlers.announce(`Ritual complete. ${session.ritual.title}.`)
  }

  const STAGES: Record<RitualStage, () => void> = {
    OPENING: runOpening,
    BREATH: runBreath,
    INVOCATION: runInvocation,
    SILENCE: runSilence,
    GROUNDING: runGrounding,
    COMPLETION: runCompletion,
  }

  const ORDER: RitualStage[] = ['OPENING', 'BREATH', 'INVOCATION', 'SILENCE', 'GROUNDING', 'COMPLETION']

  return {
    element,
    showStage(stage) {
      if (destroyed) return
      // Clearing first is what makes a stage impossible to run twice: any
      // timer belonging to the stage being left is cancelled before the next
      // one schedules anything.
      timers.clearAll()
      const previousIndex = ORDER.indexOf(stage) - 1
      if (previousIndex >= 0) markResonance(ORDER[previousIndex])
      element.dataset.stage = stage.toLowerCase()
      handlers.onStageEnter(stage)
      STAGES[stage]()
    },
    enter() {
      element.dataset.intent = session.intent
      element.setAttribute('data-intensity', session.intensity)
      geometry.setAttribute('data-profile', intentProfile(session.intent).id)
    },
    destroy() {
      destroyed = true
      timers.dispose()
    },
  }
}

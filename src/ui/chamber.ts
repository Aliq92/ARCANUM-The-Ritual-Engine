import { INTENT_ORDER, intentProfile } from '../rituals/intents'
import type { RitualIntent } from '../rituals/types'
import { createIntentDial, type IntentDial } from '../visuals/intentDial'
import { h, type View } from './dom'

export interface ChamberHandlers {
  initialIntent: RitualIntent
  onIntentChange(intent: RitualIntent): void
  onDetent(): void
  onBegin(): void
  reducedMotion(): boolean
}

/**
 * The chamber: the dial, what it currently reads, and the way in.
 *
 * There is no landing page in front of this. Opening the application puts
 * you directly at the instrument.
 */
export function createChamberView(handlers: ChamberHandlers): View {
  const intentName = h('h1', { class: 'chamber__intent' })
  const purpose = h('p', { class: 'chamber__purpose' })
  const keywords = h('ul', { class: 'chamber__keywords' })

  const readout = h('div', { class: 'chamber__readout' }, [intentName, purpose, keywords])

  const begin = h('button', { class: 'rite-button rite-button--primary', type: 'button' }, ['Begin'])
  const hint = h('p', { class: 'chamber__hint' }, ['Turn the dial to choose'])

  let dial: IntentDial | null = null

  const paint = (intent: RitualIntent) => {
    const profile = intentProfile(intent)
    intentName.textContent = profile.label
    purpose.textContent = profile.purpose
    keywords.replaceChildren(
      ...profile.keywords.map((word) => h('li', { class: 'chamber__keyword' }, [word])),
    )
    begin.setAttribute('aria-label', `Begin a ${profile.label} ritual`)
  }

  dial = createIntentDial({
    initialIntent: handlers.initialIntent,
    reducedMotion: handlers.reducedMotion,
    onDetent: handlers.onDetent,
    onChange: (intent) => {
      paint(intent)
      handlers.onIntentChange(intent)
    },
  })

  paint(handlers.initialIntent)
  begin.addEventListener('click', () => handlers.onBegin())

  const element = h('section', { class: 'view chamber', 'aria-label': 'Ritual chamber' }, [
    dial.element,
    readout,
    h('div', { class: 'chamber__actions' }, [begin, hint]),
  ])

  return {
    element,
    enter() {
      // Announce the dial's contents once, for anyone not seeing it.
      element.setAttribute(
        'aria-description',
        `Six intents: ${INTENT_ORDER.map((intent) => intentProfile(intent).label).join(', ')}.`,
      )
    },
    destroy() {
      dial?.destroy()
      dial = null
    },
  }
}

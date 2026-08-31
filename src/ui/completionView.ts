import type { RitualSession } from '../engine/ritualEngine'
import { generateSigil, renderSigilSvg } from '../visuals/sigilGenerator'
import { h } from './dom'

/**
 * The completed mark.
 *
 * The sigil is rendered whole and then settled into place layer by layer, so
 * the geometry appears to gather rather than to fade in. Restraint is the
 * point: no confetti, one low pulse, and the ritual is finished.
 */
export function createCompletionPanel(options: {
  session: RitualSession
  acknowledged: boolean
  onReturn(): void
  onArchive(): void
}): { sigil: HTMLElement; panel: HTMLElement } {
  const spec = generateSigil(options.session.seed, options.session.intent)
  const sigil = h('div', { class: 'rite__sigil rite__sigil--assembling' })
  sigil.innerHTML = renderSigilSvg(spec, { attributes: { 'aria-hidden': 'true' } })

  const message = options.acknowledged
    ? 'The mark is set. What remains is the doing.'
    : 'The mark is set. The action keeps until you are ready.'

  const done = h('button', { class: 'rite-button rite-button--primary', type: 'button' }, [
    'Return to the chamber',
  ])
  const archive = h('button', { class: 'rite-button rite-button--quiet', type: 'button' }, [
    'See the archive',
  ])
  done.addEventListener('click', () => options.onReturn())
  archive.addEventListener('click', () => options.onArchive())

  const panel = h('div', { class: 'rite__panel rite__panel--completion' }, [
    h('p', { class: 'eyebrow' }, [options.session.ritual.title]),
    h('p', { class: 'rite__closing' }, [message]),
    h('div', { class: 'rite__panel-actions' }, [done, archive]),
  ])

  return { sigil, panel }
}

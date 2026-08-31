import { h } from './dom'

/**
 * The grounding stage.
 *
 * This is where the ritual stops being decorative. One concrete action, in
 * plain language, with a way to decline that carries no penalty and no
 * reproach — the archive records what happened either way.
 */
export function createGroundingPanel(options: {
  action: string
  onAccept(): void
  onDefer(): void
}): HTMLElement {
  const accept = h('button', { class: 'rite-button rite-button--primary', type: 'button' }, [
    'I will do this.',
  ])
  const defer = h('button', { class: 'rite-button rite-button--quiet', type: 'button' }, ['Not now.'])

  accept.addEventListener('click', () => options.onAccept())
  defer.addEventListener('click', () => options.onDefer())

  return h('div', { class: 'rite__panel rite__panel--grounding' }, [
    h('p', { class: 'eyebrow' }, ['The ritual asks one thing']),
    h('p', { class: 'rite__action' }, [options.action]),
    h('div', { class: 'rite__panel-actions' }, [accept, defer]),
  ])
}

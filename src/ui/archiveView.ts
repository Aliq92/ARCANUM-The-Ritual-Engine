import { loadArchive, type ArchiveEntry } from '../storage/archiveStore'
import { intentProfile } from '../rituals/intents'
import { generateSigil, renderSigilSvg } from '../visuals/sigilGenerator'
import { h, formatArchiveDate, type View } from './dom'

const INTENSITY_LABEL: Record<ArchiveEntry['intensity'], string> = {
  whisper: 'Whisper',
  ritual: 'Ritual',
  deep: 'Deep',
}

function sigilFor(entry: ArchiveEntry, className: string): HTMLElement {
  const holder = h('div', { class: className })
  holder.innerHTML = renderSigilSvg(generateSigil(entry.seed, entry.intent), {
    attributes: { 'aria-hidden': 'true' },
  })
  return holder
}

/**
 * The archive: a chamber of completed marks.
 *
 * Deliberately not a table. Each entry is its sigil first; the words are
 * there when an entry is opened, and not before.
 */
export function createArchiveView(handlers: { onOpenChamber(): void }): View {
  const entries = loadArchive()
  const element = h('section', { class: 'view view--document archive', 'aria-label': 'Archive of completed rituals' })

  if (entries.length === 0) {
    const begin = h('button', { class: 'rite-button', type: 'button' }, ['Enter the chamber'])
    begin.addEventListener('click', () => handlers.onOpenChamber())
    element.append(
      h('div', { class: 'archive__empty' }, [
        h('p', { class: 'eyebrow' }, ['The archive is empty']),
        h('p', { class: 'archive__empty-note' }, [
          'Completed rituals leave a mark here. Nothing is recorded until one is finished.',
        ]),
        begin,
      ]),
    )
    return { element }
  }

  const detail = h('div', { class: 'archive__detail', hidden: true, role: 'dialog', 'aria-modal': 'false' })

  const closeDetail = () => {
    detail.hidden = true
    detail.replaceChildren()
    grid.removeAttribute('inert')
  }

  const openDetail = (entry: ArchiveEntry) => {
    const profile = intentProfile(entry.intent)
    const back = h('button', { class: 'rite-button rite-button--quiet', type: 'button' }, ['Close'])
    back.addEventListener('click', closeDetail)

    detail.replaceChildren(
      h('div', { class: 'archive__detail-inner', style: `--accent-h:${profile.hue};--accent-s:${profile.saturation}%;--accent-l:${profile.lightness}%` }, [
        sigilFor(entry, 'archive__detail-sigil'),
        h('p', { class: 'eyebrow' }, [`${profile.label} · ${INTENSITY_LABEL[entry.intensity]}`]),
        h('h2', { class: 'archive__detail-title' }, [entry.ritualTitle]),
        h('p', { class: 'archive__detail-date' }, [formatArchiveDate(entry.completedAt)]),
        h(
          'blockquote',
          { class: 'archive__detail-invocation' },
          entry.invocation.split('\n').map((line) => h('span', {}, [line])),
        ),
        h('div', { class: 'archive__detail-action' }, [
          h('p', { class: 'eyebrow' }, ['The grounding action']),
          h('p', { class: 'archive__detail-action-text' }, [entry.groundingAction]),
          h('p', { class: 'archive__detail-flag' }, [
            entry.groundingAcknowledged ? 'Accepted at the time.' : 'Left for later.',
          ]),
        ]),
        back,
      ]),
    )
    detail.hidden = false
    grid.setAttribute('inert', '')
    // Focus without scrolling: moving focus to the close button at the foot of
    // a long entry would otherwise scroll its sigil off the top of the screen.
    detail.scrollTop = 0
    detail.querySelector('button')?.focus({ preventScroll: true })
  }

  const grid = h(
    'ul',
    { class: 'archive__grid' },
    entries.map((entry, index) => {
      const profile = intentProfile(entry.intent)
      const button = h(
        'button',
        {
          class: 'archive__card',
          type: 'button',
          style: `--i:${Math.min(index, 12)};--accent-h:${profile.hue};--accent-s:${profile.saturation}%;--accent-l:${profile.lightness}%`,
          'aria-label': `${entry.ritualTitle}, ${profile.label}, ${formatArchiveDate(entry.completedAt)}`,
        },
        [
          sigilFor(entry, 'archive__card-sigil'),
          h('span', { class: 'archive__card-intent' }, [profile.label]),
          h('span', { class: 'archive__card-date' }, [formatArchiveDate(entry.completedAt).split(',')[0]]),
        ],
      )
      button.addEventListener('click', () => openDetail(entry))
      return h('li', {}, [button])
    }),
  )

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !detail.hidden) closeDetail()
  }
  document.addEventListener('keydown', onKeyDown)

  element.append(
    h('header', { class: 'archive__header' }, [
      h('p', { class: 'eyebrow' }, ['Completed marks']),
      h('p', { class: 'archive__count' }, [
        `${entries.length} ${entries.length === 1 ? 'ritual' : 'rituals'}`,
      ]),
    ]),
    grid,
    detail,
  )

  return {
    element,
    destroy() {
      document.removeEventListener('keydown', onKeyDown)
    },
  }
}

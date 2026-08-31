import { RITUAL_INTENSITIES, type RitualIntensity } from '../rituals/types'
import { h, type View } from './dom'

interface IntensityCopy {
  name: string
  approx: string
  note: string
  recommended?: boolean
}

const COPY: Record<RitualIntensity, IntensityCopy> = {
  whisper: {
    name: 'Whisper',
    approx: '~1 min',
    note: 'A fast reset. Enough to stop, breathe and put your feet down.',
  },
  ritual: {
    name: 'Ritual',
    approx: '~3 min',
    note: 'The full form, at a workable length. Recommended.',
    recommended: true,
  },
  deep: {
    name: 'Deep',
    approx: '~5 min',
    note: 'Longer breathing, a longer silence, and more room to sit in it.',
  },
}

/**
 * Intensity selection happens inside the chamber's own ring rather than in a
 * card laid over it — the instrument opens up, it does not get covered.
 */
export function createIntensityView(handlers: {
  onSelect(intensity: RitualIntensity): void
  onCancel(): void
}): View {
  const options = h(
    'ul',
    { class: 'intensity__options' },
    RITUAL_INTENSITIES.map((intensity, index) => {
      const copy = COPY[intensity]
      const button = h(
        'button',
        {
          class: 'intensity__button',
          type: 'button',
          'data-recommended': copy.recommended ? 'true' : 'false',
          'aria-label': `${copy.name}, approximately ${copy.approx}. ${copy.note}`,
        },
        [
          h('span', { class: 'intensity__name' }, [copy.name]),
          h('span', { class: 'intensity__time' }, [copy.approx]),
          h('span', { class: 'intensity__note' }, [copy.note]),
        ],
      )
      button.addEventListener('click', () => handlers.onSelect(intensity))
      return h('li', { class: 'intensity__option', style: `--i:${index}` }, [button])
    }),
  )

  const back = h('button', { class: 'rite-button rite-button--quiet', type: 'button' }, ['Back'])
  back.addEventListener('click', () => handlers.onCancel())

  const element = h('section', { class: 'view intensity', 'aria-label': 'Choose an intensity' }, [
    h('p', { class: 'eyebrow' }, ['How long will you stay']),
    h('div', { class: 'intensity__ring' }, [options]),
    back,
  ])

  return { element }
}

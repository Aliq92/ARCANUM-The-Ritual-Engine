import type { Settings } from '../storage/settingsStore'
import { clearArchive, loadArchive } from '../storage/archiveStore'
import { storageAvailable } from '../storage/safeStorage'
import { h, type View } from './dom'

interface ToggleSpec {
  key: 'sound' | 'haptics'
  label: string
  note: string
}

const TOGGLES: ToggleSpec[] = [
  { key: 'sound', label: 'Sound', note: 'A quiet procedural drone and breath cues.' },
  { key: 'haptics', label: 'Haptics', note: 'Short vibrations on breath and stage changes.' },
]

/**
 * Settings, kept to what changes the ritual: what you hear, what you feel,
 * and how much it moves. There is no account here and nothing to sign in to.
 */
export function createSettingsView(handlers: {
  settings: Settings
  onChange(patch: Partial<Settings>): void
  onArchiveCleared(): void
  hapticsSupported: boolean
}): View {
  const rows = TOGGLES.map((spec) => {
    const button = h('button', {
      class: 'settings__toggle',
      type: 'button',
      role: 'switch',
      'aria-checked': String(handlers.settings[spec.key]),
    })
    button.append(h('span', { class: 'settings__toggle-thumb', 'aria-hidden': 'true' }))
    button.addEventListener('click', () => {
      const next = button.getAttribute('aria-checked') !== 'true'
      button.setAttribute('aria-checked', String(next))
      handlers.onChange({ [spec.key]: next } as Partial<Settings>)
    })

    const note =
      spec.key === 'haptics' && !handlers.hapticsSupported
        ? `${spec.note} This device reports no vibration support.`
        : spec.note

    return h('div', { class: 'settings__row' }, [
      h('div', { class: 'settings__row-text' }, [
        h('p', { class: 'settings__label' }, [spec.label]),
        h('p', { class: 'settings__note' }, [note]),
      ]),
      button,
    ])
  })

  // Motion is three-state in effect — the OS preference always wins upward.
  const motionButtons = (['full', 'reduced'] as const).map((value) => {
    const button = h(
      'button',
      {
        class: 'settings__segment',
        type: 'button',
        'aria-pressed': String(handlers.settings.motion === value),
      },
      [value === 'full' ? 'Full' : 'Reduced'],
    )
    button.addEventListener('click', () => {
      for (const other of motionButtons) other.setAttribute('aria-pressed', 'false')
      button.setAttribute('aria-pressed', 'true')
      handlers.onChange({ motion: value })
    })
    return button
  })

  const motionRow = h('div', { class: 'settings__row' }, [
    h('div', { class: 'settings__row-text' }, [
      h('p', { class: 'settings__label' }, ['Motion']),
      h('p', { class: 'settings__note' }, [
        'Reduced replaces drifting and looping animation with light and opacity. The ritual is fully usable either way.',
      ]),
    ]),
    h('div', { class: 'settings__segments' }, motionButtons),
  ])

  /* Reset requires a deliberate second press, and says what it will destroy. */
  const resetZone = h('div', { class: 'settings__danger' })

  const renderReset = () => {
    const count = loadArchive().length
    const reset = h(
      'button',
      { class: 'rite-button rite-button--quiet settings__reset', type: 'button', disabled: count === 0 },
      ['Reset archive'],
    )
    reset.addEventListener('click', () => {
      const confirmButton = h('button', { class: 'rite-button settings__confirm', type: 'button' }, [
        `Delete ${count} ${count === 1 ? 'mark' : 'marks'}`,
      ])
      const cancel = h('button', { class: 'rite-button rite-button--quiet', type: 'button' }, ['Keep them'])
      confirmButton.addEventListener('click', () => {
        clearArchive()
        handlers.onArchiveCleared()
        resetZone.replaceChildren(h('p', { class: 'settings__note' }, ['The archive is empty.']))
      })
      cancel.addEventListener('click', renderReset)
      resetZone.replaceChildren(
        h('p', { class: 'settings__note settings__note--warn' }, [
          'This permanently removes every completed mark from this browser. It cannot be undone.',
        ]),
        h('div', { class: 'settings__confirm-row' }, [confirmButton, cancel]),
      )
      confirmButton.focus()
    })
    resetZone.replaceChildren(
      h('div', { class: 'settings__row' }, [
        h('div', { class: 'settings__row-text' }, [
          h('p', { class: 'settings__label' }, ['Archive']),
          h('p', { class: 'settings__note' }, [
            count === 0
              ? 'No marks recorded yet.'
              : `${count} ${count === 1 ? 'mark' : 'marks'} stored in this browser only.`,
          ]),
        ]),
        reset,
      ]),
    )
  }
  renderReset()

  const element = h('section', { class: 'view view--document settings', 'aria-label': 'Settings' }, [
    h('p', { class: 'eyebrow' }, ['The instrument']),
    h('div', { class: 'settings__group' }, [...rows, motionRow]),
    resetZone,
    h('p', { class: 'settings__footnote' }, [
      storageAvailable()
        ? 'Everything is stored on this device. Nothing leaves the browser.'
        : 'Storage is unavailable in this browser, so rituals will not be archived. The ritual itself still works.',
    ]),
  ])

  return { element }
}

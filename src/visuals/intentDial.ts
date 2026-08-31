import { INTENT_ORDER, intentProfile } from '../rituals/intents'
import type { RitualIntent } from '../rituals/types'
import { createRitualGeometry } from './ritualGeometry'

/**
 * The intent dial.
 *
 * A rotating bezel carrying six marks, read against a fixed index at the top
 * of the frame. It can be turned by dragging anywhere on the face, stepped
 * with the arrow keys, or set by pressing one of its marks. Releasing a drag
 * hands the rotation to a spring that carries a little momentum and then
 * seats itself on the nearest mark — the dial should feel like it has mass.
 */

const STEP = 360 / INTENT_ORDER.length

export interface IntentDialOptions {
  initialIntent: RitualIntent
  onChange: (intent: RitualIntent) => void
  /** Fired each time the dial seats on a new mark, for haptics and audio. */
  onDetent?: () => void
  reducedMotion: () => boolean
}

export interface IntentDial {
  element: HTMLElement
  setIntent(intent: RitualIntent, options?: { animate?: boolean }): void
  get intent(): RitualIntent
  destroy(): void
}

/** Wraps an angle into (-180, 180]. */
function shortestAngle(degrees: number): number {
  return degrees - 360 * Math.round(degrees / 360)
}

function indexFromRotation(rotation: number): number {
  const raw = Math.round(-rotation / STEP) % INTENT_ORDER.length
  return (raw + INTENT_ORDER.length) % INTENT_ORDER.length
}

export function createIntentDial(options: IntentDialOptions): IntentDial {
  const root = document.createElement('div')
  root.className = 'dial no-select'
  root.setAttribute('role', 'group')
  root.setAttribute('aria-label', 'Intent dial. Use the left and right arrow keys to turn.')
  root.tabIndex = 0

  root.innerHTML = `
    <div class="dial__frame" aria-hidden="true">
      <svg viewBox="0 0 200 200" focusable="false">
        <circle class="dial__frame-ring" cx="100" cy="100" r="96" />
        <circle class="dial__frame-graduations" cx="100" cy="100" r="88" />
        <circle class="dial__frame-inner" cx="100" cy="100" r="74" />
      </svg>
    </div>
    <div class="dial__index" aria-hidden="true"></div>
    <div class="dial__core"></div>
    <div class="dial__ring"></div>
  `

  const core = root.querySelector<HTMLElement>('.dial__core')!
  const ring = root.querySelector<HTMLElement>('.dial__ring')!
  core.append(createRitualGeometry())

  const nodes = INTENT_ORDER.map((intent, index) => {
    const profile = intentProfile(intent)
    const node = document.createElement('button')
    node.type = 'button'
    node.className = 'dial__node'
    node.style.setProperty('--i', String(index))
    node.dataset.intent = intent
    node.setAttribute('aria-label', `${profile.label}. ${profile.purpose}`)
    node.innerHTML = `
      <span class="dial__node-tick" aria-hidden="true"></span>
      <span class="dial__node-dot" aria-hidden="true"></span>
    `
    ring.append(node)
    return node
  })

  let rotation = -INTENT_ORDER.indexOf(options.initialIntent) * STEP
  let target = rotation
  let velocity = 0
  let current = options.initialIntent
  let frame = 0
  let dragging = false
  let moved = 0
  let pointerId: number | null = null
  let grabAngle = 0
  let grabRotation = 0
  let lastMoveTime = 0
  let destroyed = false

  const apply = () => {
    ring.style.setProperty('--rotation', `${rotation.toFixed(2)}deg`)
    const index = indexFromRotation(rotation)
    const intent = INTENT_ORDER[index]
    for (const [i, node] of nodes.entries()) {
      node.dataset.selected = String(i === index)
      node.setAttribute('aria-pressed', String(i === index))
    }
    if (intent !== current) {
      current = intent
      options.onDetent?.()
      options.onChange(intent)
    }
  }

  const stop = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  /** A light spring: enough momentum to feel mechanical, none to overshoot far. */
  const settle = () => {
    stop()
    const step = () => {
      frame = 0
      const difference = target - rotation
      velocity = (velocity + difference * 0.14) * 0.72
      rotation += velocity
      if (Math.abs(difference) < 0.04 && Math.abs(velocity) < 0.04) {
        rotation = target
        velocity = 0
        apply()
        return
      }
      apply()
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  const snapTo = (nextTarget: number, animate = true) => {
    target = nextTarget
    if (!animate || options.reducedMotion()) {
      stop()
      rotation = target
      velocity = 0
      apply()
      return
    }
    settle()
  }

  const angleOf = (event: PointerEvent): number => {
    const rect = root.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI
  }

  const onPointerDown = (event: PointerEvent) => {
    if (pointerId !== null) return
    pointerId = event.pointerId
    dragging = true
    moved = 0
    velocity = 0
    grabAngle = angleOf(event)
    grabRotation = rotation
    lastMoveTime = event.timeStamp
    stop()
    root.setPointerCapture(event.pointerId)
    root.dataset.dragging = 'true'
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return
    const delta = shortestAngle(angleOf(event) - grabAngle)
    const next = grabRotation + delta
    const elapsed = Math.max(1, event.timeStamp - lastMoveTime)
    // Degrees per frame, so the release spring can carry it on.
    velocity = ((next - rotation) / elapsed) * 16
    moved += Math.abs(next - rotation)
    rotation = next
    lastMoveTime = event.timeStamp
    apply()
  }

  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    dragging = false
    pointerId = null
    delete root.dataset.dragging
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId)
    // Let the throw carry a little before choosing the mark to seat on.
    const predicted = rotation + velocity * 6
    snapTo(Math.round(predicted / STEP) * STEP)
  }

  const onClick = (event: MouseEvent) => {
    // A drag ends with a click event; only a genuine press should select.
    if (moved > 10) {
      event.preventDefault()
      event.stopPropagation()
      moved = 0
      return
    }
    const button = (event.target as HTMLElement).closest<HTMLElement>('.dial__node')
    if (!button?.dataset.intent) return
    setIntent(button.dataset.intent as RitualIntent)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      snapTo(target - STEP)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      snapTo(target + STEP)
    }
  }

  const setIntent = (intent: RitualIntent, opts: { animate?: boolean } = {}) => {
    const index = INTENT_ORDER.indexOf(intent)
    if (index < 0) return
    // Turn whichever way is shorter rather than unwinding the long way round.
    const desired = -index * STEP
    snapTo(rotation + shortestAngle(desired - rotation), opts.animate !== false)
  }

  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('pointermove', onPointerMove)
  root.addEventListener('pointerup', endDrag)
  root.addEventListener('pointercancel', endDrag)
  root.addEventListener('click', onClick, true)
  root.addEventListener('keydown', onKeyDown)

  apply()

  return {
    element: root,
    setIntent,
    get intent() {
      return current
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      stop()
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', endDrag)
      root.removeEventListener('pointercancel', endDrag)
      root.removeEventListener('click', onClick, true)
      root.removeEventListener('keydown', onKeyDown)
    },
  }
}

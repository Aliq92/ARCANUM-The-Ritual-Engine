/**
 * A group of timers with a single owner.
 *
 * Ritual stages start and stop constantly, and a stage that leaves a timer
 * behind will fire into the next one. Every timeout, interval and animation
 * frame in the running ritual is registered here so that `clearAll` at a
 * stage boundary is enough to guarantee nothing stacks.
 */

type Handle = number

interface Entry {
  kind: 'timeout' | 'interval' | 'frame'
  id: number
}

export class TimerGroup {
  #entries = new Map<Handle, Entry>()
  #next = 1
  #disposed = false

  get size(): number {
    return this.#entries.size
  }

  get disposed(): boolean {
    return this.#disposed
  }

  timeout(callback: () => void, ms: number): Handle {
    if (this.#disposed) return 0
    const handle = this.#next++
    const id = window.setTimeout(() => {
      this.#entries.delete(handle)
      callback()
    }, ms)
    this.#entries.set(handle, { kind: 'timeout', id })
    return handle
  }

  interval(callback: () => void, ms: number): Handle {
    if (this.#disposed) return 0
    const handle = this.#next++
    const id = window.setInterval(callback, ms)
    this.#entries.set(handle, { kind: 'interval', id })
    return handle
  }

  frame(callback: FrameRequestCallback): Handle {
    if (this.#disposed) return 0
    const handle = this.#next++
    const id = requestAnimationFrame((time) => {
      this.#entries.delete(handle)
      callback(time)
    })
    this.#entries.set(handle, { kind: 'frame', id })
    return handle
  }

  clear(handle: Handle): void {
    const entry = this.#entries.get(handle)
    if (!entry) return
    this.#entries.delete(handle)
    if (entry.kind === 'timeout') clearTimeout(entry.id)
    else if (entry.kind === 'interval') clearInterval(entry.id)
    else cancelAnimationFrame(entry.id)
  }

  clearAll(): void {
    for (const handle of [...this.#entries.keys()]) this.clear(handle)
  }

  /** Clears everything and refuses all future work. */
  dispose(): void {
    this.clearAll()
    this.#disposed = true
  }
}

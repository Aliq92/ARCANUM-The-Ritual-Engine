import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TimerGroup } from '../src/engine/timers'

describe('TimerGroup', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs a scheduled callback once', () => {
    const group = new TimerGroup()
    const fn = vi.fn()
    group.timeout(fn, 100)
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancels everything it owns', () => {
    const group = new TimerGroup()
    const a = vi.fn()
    const b = vi.fn()
    group.timeout(a, 50)
    group.interval(b, 10)
    group.clearAll()
    vi.advanceTimersByTime(1000)
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
    expect(group.size).toBe(0)
  })

  it('does not stack timers when a stage is restarted', () => {
    const group = new TimerGroup()
    const fn = vi.fn()
    for (let i = 0; i < 5; i++) {
      group.clearAll()
      group.timeout(fn, 100)
    }
    expect(group.size).toBe(1)
    vi.advanceTimersByTime(400)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('forgets a one-shot timer after it fires', () => {
    const group = new TimerGroup()
    group.timeout(() => {}, 20)
    expect(group.size).toBe(1)
    vi.advanceTimersByTime(30)
    expect(group.size).toBe(0)
  })

  it('cancels a single handle without touching the others', () => {
    const group = new TimerGroup()
    const a = vi.fn()
    const b = vi.fn()
    const handle = group.timeout(a, 40)
    group.timeout(b, 40)
    group.clear(handle)
    vi.advanceTimersByTime(100)
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('refuses to schedule anything once disposed', () => {
    const group = new TimerGroup()
    const fn = vi.fn()
    group.dispose()
    group.timeout(fn, 10)
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
    expect(group.size).toBe(0)
  })
})

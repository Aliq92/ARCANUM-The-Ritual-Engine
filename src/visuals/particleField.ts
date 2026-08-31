import type { IntentProfile } from '../rituals/intents'

/**
 * The ambient field behind the instrument.
 *
 * Deliberately small: around seventy motes drawn from one pre-rendered
 * sprite, integrated with a fixed force per intent. There is no physics
 * engine here and no per-particle allocation after construction. The loop
 * stops entirely when the tab is hidden, when the field is off screen, or
 * when reduced motion is in force — in that last case a single static frame
 * is drawn instead, so the atmosphere survives without any movement.
 */

export type ParticleMode = IntentProfile['particleMode']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  seed: number
}

const BASE_COUNT = 74

export interface ParticleField {
  setIntent(profile: IntentProfile): void
  setReducedMotion(reduced: boolean): void
  /** Raises or lowers the whole field, e.g. during silence. */
  setEnergy(energy: number): void
  destroy(): void
}

function makeSprite(color: string): HTMLCanvasElement {
  const size = 32
  const sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size
  const ctx = sprite.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, color)
    gradient.addColorStop(0.45, color.replace(')', ' / 0.35)'))
    gradient.addColorStop(1, 'transparent')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  return sprite
}

export function createParticleField(canvas: HTMLCanvasElement): ParticleField {
  const ctx = canvas.getContext('2d', { alpha: true })
  let particles: Particle[] = []
  let width = 0
  let height = 0
  let dpr = 1
  let mode: ParticleMode = 'slow'
  let sprite = makeSprite('hsl(205 34% 66%)')
  let energy = 1
  let reduced = false
  let frame = 0
  let last = 0
  let destroyed = false

  const seedParticles = () => {
    const count = Math.round(BASE_COUNT * Math.min(1, Math.max(0.5, (width * height) / (390 * 780))))
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      size: 0.8 + Math.random() * 2.4,
      alpha: 0.12 + Math.random() * 0.4,
      seed: Math.random() * Math.PI * 2,
    }))
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    // Two device pixels is plenty for soft motes and keeps fill rate down.
    dpr = Math.min(2, window.devicePixelRatio || 1)
    width = Math.max(1, rect.width)
    height = Math.max(1, rect.height)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (particles.length === 0) seedParticles()
  }

  const respawn = (particle: Particle, cx: number, cy: number) => {
    if (mode === 'dissolve') {
      // CLEAR: motes leave the frame and are replaced near the centre.
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * Math.min(width, height) * 0.14
      particle.x = cx + Math.cos(angle) * radius
      particle.y = cy + Math.sin(angle) * radius
    } else {
      particle.x = Math.random() * width
      particle.y = Math.random() * height
    }
    particle.vx = (Math.random() - 0.5) * 6
    particle.vy = (Math.random() - 0.5) * 6
    particle.alpha = 0.12 + Math.random() * 0.4
  }

  const step = (dt: number, time: number) => {
    const cx = width / 2
    const cy = height * 0.44
    const reach = Math.min(width, height)

    for (const particle of particles) {
      const dx = particle.x - cx
      const dy = particle.y - cy
      const distance = Math.hypot(dx, dy) || 0.0001
      const nx = dx / distance
      const ny = dy / distance
      let damping = 0.986

      switch (mode) {
        case 'inward': {
          // GUARD: settle onto a defended radius and hold there.
          const target = reach * 0.3
          const pull = (target - distance) * 0.9
          particle.vx += nx * pull * dt
          particle.vy += ny * pull * dt
          particle.vx += -ny * 6 * dt
          particle.vy += nx * 6 * dt
          damping = 0.93
          break
        }
        case 'slow': {
          // STILL: almost no force, and heavy damping. Everything decelerates.
          particle.vx += Math.cos(particle.seed + time * 0.00006) * 1.4 * dt
          particle.vy += Math.sin(particle.seed + time * 0.00005) * 1.4 * dt
          damping = 0.975
          break
        }
        case 'converge': {
          // MEND: drawn back together, but gently and never all the way.
          const target = reach * (0.16 + 0.1 * Math.sin(particle.seed + time * 0.0002))
          const pull = (target - distance) * 0.55
          particle.vx += nx * pull * dt
          particle.vy += ny * pull * dt
          damping = 0.95
          break
        }
        case 'dissolve': {
          // CLEAR: pushed outward and faded until nothing unnecessary remains.
          particle.vx += nx * 26 * dt
          particle.vy += ny * 26 * dt
          particle.alpha -= dt * 0.16
          damping = 0.99
          break
        }
        case 'orbit': {
          // SEEK: independent circular travel, each at its own rate.
          const rate = 0.22 + (particle.seed % 1) * 0.4
          particle.vx += -ny * distance * rate * dt
          particle.vy += nx * distance * rate * dt
          particle.vx += nx * (reach * 0.34 - distance) * 0.5 * dt
          particle.vy += ny * (reach * 0.34 - distance) * 0.5 * dt
          damping = 0.92
          break
        }
        case 'align': {
          // RESOLVE: everything driven onto one vertical axis.
          particle.vx += (cx - particle.x) * 1.5 * dt
          particle.vy += 7 * dt
          damping = 0.94
          break
        }
      }

      particle.vx *= damping
      particle.vy *= damping
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt

      const offscreen =
        particle.x < -40 || particle.x > width + 40 || particle.y < -40 || particle.y > height + 40
      if (offscreen || particle.alpha <= 0.01) respawn(particle, cx, cy)
    }
  }

  const draw = (time: number) => {
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'lighter'
    for (const particle of particles) {
      const flicker = 0.75 + 0.25 * Math.sin(particle.seed + time * 0.0006)
      const size = particle.size * 4.6
      ctx.globalAlpha = Math.max(0, Math.min(1, particle.alpha * flicker * energy * 0.42))
      ctx.drawImage(sprite, particle.x - size / 2, particle.y - size / 2, size, size)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  const loop = (time: number) => {
    frame = 0
    // Clamped so a backgrounded tab cannot resume with an enormous step.
    const dt = Math.min(0.05, (time - last) / 1000 || 0.016)
    last = time
    step(dt, time)
    draw(time)
    schedule()
  }

  const schedule = () => {
    if (destroyed || reduced || document.hidden || frame) return
    frame = requestAnimationFrame(loop)
  }

  const stop = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  const onVisibility = () => {
    if (document.hidden) {
      stop()
    } else {
      last = performance.now()
      schedule()
    }
  }

  const onResize = () => {
    resize()
    if (reduced) draw(performance.now())
  }

  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('orientationchange', onResize, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)

  resize()
  last = performance.now()
  schedule()

  return {
    setIntent(profile) {
      mode = profile.particleMode
      sprite = makeSprite(`hsl(${profile.hue} ${profile.saturation}% ${profile.lightness}%)`)
      if (reduced) draw(performance.now())
    },
    setReducedMotion(next) {
      reduced = next
      if (reduced) {
        stop()
        // One settled frame, so the field is present without moving.
        step(0.9, performance.now())
        draw(performance.now())
      } else {
        last = performance.now()
        schedule()
      }
    },
    setEnergy(next) {
      energy = Math.max(0, Math.min(1, next))
      if (reduced) draw(performance.now())
    },
    destroy() {
      destroyed = true
      stop()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      ctx?.clearRect(0, 0, width, height)
    },
  }
}

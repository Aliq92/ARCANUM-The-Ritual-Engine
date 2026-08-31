import type { RitualIntent } from '../rituals/types'
import { createRng, type Rng } from '../util/random'

/**
 * The sigil generator.
 *
 * A completed ritual leaves one mark. The mark is built from a small set of
 * primitives — rings, arcs, radial lines, closed paths and nodes — so that
 * every sigil in the archive reads as part of one family, while the seed and
 * the intent decide the particular composition.
 *
 * Each intent biases the composition differently:
 *
 *   GUARD    concentric rings and an enclosed form
 *   STILL    mirror symmetry and very few strokes
 *   MEND     broken arcs with the breaks bridged
 *   CLEAR    minimal geometry and a great deal of negative space
 *   SEEK     independent orbits, astrolabe-like
 *   RESOLVE  a strong axis with everything driven onto it
 */

export const SIGIL_VIEWBOX = 200

const C = SIGIL_VIEWBOX / 2
const R_FRAME = 88

/** Primitives are drawn in layer order, which is also resonance order. */
export const SIGIL_LAYERS = 5

interface Base {
  /** 0 to SIGIL_LAYERS - 1. Lower layers settle first during completion. */
  layer: number
  opacity: number
}

export type SigilPrimitive =
  | (Base & { kind: 'ring'; cx: number; cy: number; r: number; width: number; dash?: string })
  | (Base & {
      kind: 'arc'
      cx: number
      cy: number
      r: number
      startAngle: number
      endAngle: number
      width: number
    })
  | (Base & { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number })
  | (Base & { kind: 'node'; cx: number; cy: number; r: number; filled: boolean })
  | (Base & { kind: 'path'; points: [number, number][]; closed: boolean; width: number })

export interface SigilSpec {
  seed: string
  intent: RitualIntent
  size: number
  primitives: SigilPrimitive[]
}

const TAU = Math.PI * 2

function polar(radius: number, angle: number): [number, number] {
  return [C + Math.cos(angle) * radius, C + Math.sin(angle) * radius]
}

function ring(r: number, layer: number, opacity: number, width = 1, dash?: string): SigilPrimitive {
  return { kind: 'ring', cx: C, cy: C, r, width, opacity, layer, ...(dash ? { dash } : {}) }
}

function node(radius: number, angle: number, size: number, filled: boolean, layer: number, opacity: number): SigilPrimitive {
  const [cx, cy] = polar(radius, angle)
  return { kind: 'node', cx, cy, r: size, filled, opacity, layer }
}

function spoke(
  innerRadius: number,
  outerRadius: number,
  angle: number,
  layer: number,
  opacity: number,
  width = 0.9,
): SigilPrimitive {
  const [x1, y1] = polar(innerRadius, angle)
  const [x2, y2] = polar(outerRadius, angle)
  return { kind: 'line', x1, y1, x2, y2, width, opacity, layer }
}

function polygon(radius: number, sides: number, rotation: number, layer: number, opacity: number): SigilPrimitive {
  const points: [number, number][] = []
  for (let i = 0; i < sides; i++) {
    points.push(polar(radius, rotation + (i / sides) * TAU))
  }
  return { kind: 'path', points, closed: true, width: 1, opacity, layer }
}

function arc(
  r: number,
  startAngle: number,
  endAngle: number,
  layer: number,
  opacity: number,
  width = 1,
): SigilPrimitive {
  return { kind: 'arc', cx: C, cy: C, r, startAngle, endAngle, width, opacity, layer }
}

/* ------------------------------------------------------------------ */
/* Per-intent composition                                              */
/* ------------------------------------------------------------------ */

function buildGuard(rng: Rng): SigilPrimitive[] {
  const parts: SigilPrimitive[] = []
  // Concentric enclosure: the defining gesture of GUARD.
  const count = rng.int(3, 5)
  for (let i = 0; i < count; i++) {
    const r = 34 + (i / Math.max(1, count - 1)) * 42 + rng.jitter(2.5)
    parts.push(ring(r, i < 2 ? 0 : 1, 0.3 + 0.16 * (1 - i / count), i === 0 ? 1.3 : 0.85))
  }
  // One enclosed form at the heart.
  parts.push(polygon(rng.range(24, 34), rng.int(3, 6), rng.range(0, TAU), 2, 0.62))
  // Short ticks just inside the frame: a perimeter, kept.
  const ticks = rng.int(6, 10)
  const offset = rng.range(0, TAU)
  for (let i = 0; i < ticks; i++) {
    const angle = offset + (i / ticks) * TAU
    parts.push(spoke(R_FRAME - rng.range(7, 12), R_FRAME, angle, 3, 0.4))
  }
  const marks = rng.int(3, 6)
  for (let i = 0; i < marks; i++) {
    parts.push(node(rng.pick([48, 62, 76]), offset + (i / marks) * TAU + rng.jitter(0.12), 1.6, true, 4, 0.72))
  }
  return parts
}

function buildStill(rng: Rng): SigilPrimitive[] {
  const parts: SigilPrimitive[] = []
  parts.push(ring(rng.range(52, 66), 1, 0.3, 0.85))
  if (rng.chance(0.45)) parts.push(ring(rng.range(24, 32), 1, 0.22, 0.7))

  // A pair of quiet arcs, mirrored across the horizontal.
  const span = rng.range(0.5, 1.0)
  const r = rng.range(70, 80)
  parts.push(arc(r, Math.PI - span, Math.PI + span, 1, 0.34, 0.8))
  parts.push(arc(r, -span, span, 1, 0.34, 0.8))

  // One level line: the horizon.
  const reach = rng.range(38, 58)
  parts.push({ kind: 'line', x1: C - reach, y1: C, x2: C + reach, y2: C, width: 0.9, opacity: 0.42, layer: 2 })

  // Mirrored nodes only — nothing here is asymmetric.
  const pairs = rng.int(2, 3)
  for (let i = 0; i < pairs; i++) {
    const angle = rng.range(0.25, Math.PI / 2 - 0.12)
    const radius = rng.pick([34, 46, 58, 70])
    for (const a of [angle, Math.PI - angle, Math.PI + angle, -angle]) {
      parts.push(node(radius, a, 1.5, i === 0, 3 + (i % 2), 0.6))
    }
  }
  return parts
}

function buildMend(rng: Rng): SigilPrimitive[] {
  const parts: SigilPrimitive[] = []
  parts.push(ring(rng.range(72, 80), 1, 0.22, 0.75))

  /**
   * Two broken rings, each with its gaps bridged. The break stays visible —
   * a mended thing keeps the line of its repair — but nothing is left open.
   */
  const buildBrokenRing = (radius: number, segments: number, offset: number, layer: number, opacity: number) => {
    const gap = rng.range(0.2, 0.32)
    for (let i = 0; i < segments; i++) {
      const start = offset + (i / segments) * TAU + gap / 2
      const end = offset + ((i + 1) / segments) * TAU - gap / 2
      parts.push(arc(radius, start, end, layer, opacity, 1.05))
      // The repair: a short chord laid across the break.
      const [x1, y1] = polar(radius, end)
      const [x2, y2] = polar(radius, end + gap)
      parts.push({ kind: 'line', x1, y1, x2, y2, width: 0.85, opacity: opacity + 0.2, layer: layer + 1 })
      parts.push(node(radius, end + gap / 2, 1.3, true, 4, 0.65))
    }
  }

  const outerRadius = rng.range(52, 62)
  const outerSegments = rng.int(5, 7)
  const offset = rng.range(0, TAU)
  buildBrokenRing(outerRadius, outerSegments, offset, 1, 0.44)

  if (rng.chance(0.75)) {
    // The inner ring is offset so the two sets of breaks never line up.
    buildBrokenRing(rng.range(26, 38), rng.int(3, 4), offset + Math.PI / outerSegments, 2, 0.34)
  }

  // Two stitches laid across the broken ring, mirrored so the form stays
  // balanced. They cross the ring rather than meeting at the centre, so no
  // accidental diameter cuts the sigil in half.
  const stitchAngle = offset + rng.range(0, TAU)
  const stitchReach = rng.range(11, 17)
  for (const angle of [stitchAngle, stitchAngle + Math.PI]) {
    parts.push(spoke(outerRadius - stitchReach, outerRadius + stitchReach, angle, 3, 0.46, 0.85))
  }
  return parts
}

function buildClear(rng: Rng): SigilPrimitive[] {
  const parts: SigilPrimitive[] = []
  // Almost nothing is drawn. What remains is placed deliberately, and the
  // space between the marks is the point.
  const outerRadius = rng.range(58, 74)
  const start = rng.range(0, TAU)
  parts.push(arc(outerRadius, start, start + rng.range(1.4, 2.6), 1, 0.42, 1))

  const innerRadius = rng.range(30, 44)
  const second = start + Math.PI + rng.jitter(0.5)
  parts.push(arc(innerRadius, second, second + rng.range(0.7, 1.5), 2, 0.32, 0.9))

  if (rng.chance(0.45)) parts.push(ring(rng.range(14, 22), 1, 0.24, 0.7))

  // A single short stroke, kept level, rather than a diagonal across the frame.
  const reach = rng.range(12, 22)
  parts.push({ kind: 'line', x1: C - reach, y1: C, x2: C + reach, y2: C, width: 0.85, opacity: 0.4, layer: 2 })

  // Marks sit on the arcs that are already there, never at random radii.
  parts.push(node(outerRadius, start, 1.6, true, 3, 0.6))
  parts.push(node(innerRadius, second, 1.4, false, 3, 0.5))
  const strays = rng.int(1, 3)
  for (let i = 0; i < strays; i++) {
    parts.push(node(rng.pick([innerRadius, outerRadius]), rng.range(0, TAU), 1.2, rng.chance(0.4), 4, 0.42))
  }
  return parts
}

function buildSeek(rng: Rng): SigilPrimitive[] {
  const parts: SigilPrimitive[] = []
  parts.push(ring(rng.range(70, 80), 1, 0.24, 0.75, '1 5'))

  // Independent orbits at their own radii and angles: an astrolabe, mid-alignment.
  const orbits = rng.int(4, 6)
  for (let i = 0; i < orbits; i++) {
    const radius = 22 + (i / orbits) * 52 + rng.jitter(3)
    const start = rng.range(0, TAU)
    const span = rng.range(1.1, 4.4)
    parts.push(arc(radius, start, start + span, i < 2 ? 1 : 2, 0.3 + 0.1 * (i % 3), i === 0 ? 1.2 : 0.85))
    // Each orbit carries one mark.
    parts.push(node(radius, start + span, 1.7, i % 2 === 0, 4, 0.7))
  }
  // Sight lines through the instrument.
  const sights = rng.int(1, 2)
  for (let i = 0; i < sights; i++) {
    const angle = rng.range(0, TAU)
    const [x1, y1] = polar(-rng.range(50, 80), angle)
    const [x2, y2] = polar(rng.range(50, 80), angle)
    parts.push({ kind: 'line', x1, y1, x2, y2, width: 0.8, opacity: 0.32, layer: 3 })
  }
  return parts
}

function buildResolve(rng: Rng): SigilPrimitive[] {
  const parts: SigilPrimitive[] = []
  if (rng.chance(0.55)) parts.push(ring(rng.range(38, 52), 1, 0.18, 0.7))

  // The axis. Almost always upright: this set is about holding a line.
  const axisAngle = rng.chance(0.9) ? -Math.PI / 2 : rng.range(0, TAU)
  const reach = rng.range(68, 82)
  const [ax1, ay1] = polar(-reach, axisAngle)
  const [ax2, ay2] = polar(reach, axisAngle)
  parts.push({ kind: 'line', x1: ax1, y1: ay1, x2: ax2, y2: ay2, width: 1.5, opacity: 0.7, layer: 1 })

  // Unit vector perpendicular to the axis, for everything that crosses it.
  const px = Math.cos(axisAngle + Math.PI / 2)
  const py = Math.sin(axisAngle + Math.PI / 2)

  // Fragments locked across the axis, longest at the centre: a spine.
  const rungs = rng.int(3, 5)
  for (let i = 0; i < rungs; i++) {
    const t = (i + 1) / (rungs + 1)
    const along = -reach * 0.72 + t * reach * 1.44
    const [bx, by] = polar(along, axisAngle)
    const taper = 1 - Math.abs(along) / (reach * 0.9)
    const length = rng.range(10, 26) * (0.45 + 0.55 * taper)
    parts.push({
      kind: 'line',
      x1: bx - px * length,
      y1: by - py * length,
      x2: bx + px * length,
      y2: by + py * length,
      width: 1,
      opacity: 0.34 + 0.26 * taper,
      layer: i < 2 ? 2 : 3,
    })
  }

  // Two lines drawn in from the rim to a single point on the axis.
  const focus = rng.range(-reach * 0.35, reach * 0.35)
  const [fx, fy] = polar(focus, axisAngle)
  const spread = rng.range(0.5, 1.0)
  for (const side of [1, -1]) {
    const [sx, sy] = polar(rng.range(62, 80), axisAngle + Math.PI + spread * side)
    parts.push({ kind: 'line', x1: sx, y1: sy, x2: fx, y2: fy, width: 0.85, opacity: 0.38, layer: 3 })
  }

  const marks = rng.int(2, 4)
  for (let i = 0; i < marks; i++) {
    const along = -reach * 0.7 + ((i + 1) / (marks + 1)) * reach * 1.4
    parts.push(node(along, axisAngle, i === 0 ? 2.2 : 1.5, true, 4, 0.75))
  }
  return parts
}

const BUILDERS: Record<RitualIntent, (rng: Rng) => SigilPrimitive[]> = {
  guard: buildGuard,
  still: buildStill,
  mend: buildMend,
  clear: buildClear,
  seek: buildSeek,
  resolve: buildResolve,
}

/**
 * Builds the sigil for a seed.
 *
 * The frame ring and centre node are shared by every mark in the archive —
 * they are what makes eighty different sigils look like one collection.
 */
export function generateSigil(seed: string, intent: RitualIntent): SigilSpec {
  const rng = createRng(`${intent}|${seed}`)

  const primitives: SigilPrimitive[] = [
    ring(R_FRAME, 0, 0.32, 1),
    { kind: 'node', cx: C, cy: C, r: 2.4, filled: true, opacity: 0.9, layer: 0 },
  ]
  primitives.push(...BUILDERS[intent](rng))

  // A readable minimum: sparse intents still need enough marks to be a sigil.
  while (primitives.length < 8) {
    primitives.push(node(rng.range(26, 78), rng.range(0, TAU), 1.3, rng.chance(0.5), 4, 0.5))
  }

  primitives.sort((a, b) => a.layer - b.layer)
  return { seed, intent, size: SIGIL_VIEWBOX, primitives }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/** Two decimals: tidy markup, and identical output for identical input. */
const f = (value: number): string => {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function arcPath(primitive: Extract<SigilPrimitive, { kind: 'arc' }>): string {
  const { cx, cy, r, startAngle, endAngle } = primitive
  const sweepAngle = endAngle - startAngle
  const largeArc = Math.abs(sweepAngle) > Math.PI ? 1 : 0
  const sweep = sweepAngle >= 0 ? 1 : 0
  const x1 = cx + Math.cos(startAngle) * r
  const y1 = cy + Math.sin(startAngle) * r
  const x2 = cx + Math.cos(endAngle) * r
  const y2 = cy + Math.sin(endAngle) * r
  return `M ${f(x1)} ${f(y1)} A ${f(r)} ${f(r)} 0 ${largeArc} ${sweep} ${f(x2)} ${f(y2)}`
}

function primitiveMarkup(primitive: SigilPrimitive): string {
  const o = f(primitive.opacity)
  switch (primitive.kind) {
    case 'ring':
      return `<circle cx="${f(primitive.cx)}" cy="${f(primitive.cy)}" r="${f(primitive.r)}" stroke-width="${f(primitive.width)}" opacity="${o}"${primitive.dash ? ` stroke-dasharray="${primitive.dash}"` : ''}/>`
    case 'arc':
      return `<path d="${arcPath(primitive)}" stroke-width="${f(primitive.width)}" opacity="${o}"/>`
    case 'line':
      return `<line x1="${f(primitive.x1)}" y1="${f(primitive.y1)}" x2="${f(primitive.x2)}" y2="${f(primitive.y2)}" stroke-width="${f(primitive.width)}" opacity="${o}"/>`
    case 'node':
      return `<circle cx="${f(primitive.cx)}" cy="${f(primitive.cy)}" r="${f(primitive.r)}" opacity="${o}"${primitive.filled ? ' fill="currentColor" stroke="none"' : ' stroke-width="0.9"'}/>`
    case 'path': {
      const d = primitive.points
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${f(x)} ${f(y)}`)
        .join(' ')
      return `<path d="${d}${primitive.closed ? ' Z' : ''}" stroke-width="${f(primitive.width)}" opacity="${o}"/>`
    }
  }
}

export interface SigilRenderOptions {
  /**
   * 0 to 1. Below 1, only the layers earned so far are drawn — this is what
   * lets the mark assemble itself as the ritual progresses.
   */
  resonance?: number
  /** Extra attributes for the root element, e.g. `aria-hidden="true"`. */
  attributes?: Record<string, string>
}

export function renderSigilSvg(spec: SigilSpec, options: SigilRenderOptions = {}): string {
  const resonance = Math.max(0, Math.min(1, options.resonance ?? 1))
  const visible = spec.primitives.filter((primitive) => primitive.layer / SIGIL_LAYERS < resonance + 1e-9)
  const extra = Object.entries(options.attributes ?? {})
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.size} ${spec.size}" class="sigil" data-intent="${spec.intent}"${extra}>`,
    '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">',
    ...visible.map(primitiveMarkup),
    '</g>',
    '</svg>',
  ].join('')
}

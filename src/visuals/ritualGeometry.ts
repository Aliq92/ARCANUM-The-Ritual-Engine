/**
 * The core symbol at the centre of the instrument.
 *
 * One SVG serves every intent and every stage. Which parts are lit, how far
 * the fragments sit from the centre and how fast the orbits turn are all
 * decided in CSS from `data-intent`, `--resonance` and `--breath-scale`, so
 * changing intent costs a single attribute write rather than a rebuild — and
 * nothing here runs an animation frame loop.
 */

const NS = 'http://www.w3.org/2000/svg'

const FRAGMENT_COUNT = 8
const SPOKE_COUNT = 12

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  return node
}

function group(className: string): SVGGElement {
  return el('g', { class: className })
}

export function createRitualGeometry(): SVGSVGElement {
  const svg = el('svg', {
    viewBox: '0 0 200 200',
    class: 'geo',
    'aria-hidden': 'true',
    focusable: 'false',
  })

  // Concentric enclosure.
  const rings = group('geo__rings')
  for (const [index, radius] of [30, 48, 66].entries()) {
    rings.append(el('circle', { class: 'geo__ring', cx: 100, cy: 100, r: radius, style: `--i:${index}` }))
  }

  // Independent orbits, dashed so their rotation is legible.
  const orbits = group('geo__orbits')
  orbits.append(
    el('circle', { class: 'geo__orbit geo__orbit--outer', cx: 100, cy: 100, r: 84 }),
    el('circle', { class: 'geo__orbit geo__orbit--inner', cx: 100, cy: 100, r: 58 }),
  )

  // Graduations around the rim: the bezel of an instrument.
  const spokes = group('geo__spokes')
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const spoke = el('line', { class: 'geo__spoke', x1: 100, y1: 14, x2: 100, y2: 22, style: `--i:${i}` })
    spoke.setAttribute('transform', `rotate(${(i * 360) / SPOKE_COUNT} 100 100)`)
    spokes.append(spoke)
  }

  /**
   * Loose fragments. Each intent moves these differently.
   *
   * Their rotation is set in CSS from `--i` rather than with an SVG transform
   * attribute: the two do not agree once `transform-box` is involved, and the
   * attribute version escapes the viewBox entirely on narrow screens.
   */
  const fragments = group('geo__fragments')
  for (let i = 0; i < FRAGMENT_COUNT; i++) {
    const holder = el('g', {
      class: 'geo__fragment',
      style: `--i:${i};--fragment-angle:${(i * 360) / FRAGMENT_COUNT}deg`,
    })
    holder.append(el('line', { class: 'geo__fragment-line', x1: 100, y1: 58, x2: 100, y2: 44 }))
    fragments.append(holder)
  }

  // The breath halo and the core.
  const halo = el('circle', { class: 'geo__halo', cx: 100, cy: 100, r: 40 })
  const core = el('circle', { class: 'geo__core', cx: 100, cy: 100, r: 3.2 })
  const aura = el('circle', { class: 'geo__aura', cx: 100, cy: 100, r: 16 })

  svg.append(orbits, rings, spokes, fragments, halo, aura, core)
  return svg
}

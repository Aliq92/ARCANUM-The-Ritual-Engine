/** Small DOM helpers, so views read as structure rather than boilerplate. */

type Attributes = Record<string, string | number | boolean | undefined>

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue
    if (key === 'class') element.className = String(value)
    else if (key === 'text') element.textContent = String(value)
    else element.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children) {
    if (child === null || child === undefined) continue
    element.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return element
}

/** A view is a detachable piece of the stage with its own cleanup. */
export interface View {
  element: HTMLElement
  /** Runs once the element is in the document. */
  enter?(): void
  destroy?(): void
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes === 0) return `${rest}s`
  if (rest === 0) return `${minutes} min`
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function formatArchiveDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toISOString().slice(0, 16).replace('T', ' ')
  }
}

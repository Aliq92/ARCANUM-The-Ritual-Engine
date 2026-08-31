import './styles/tokens.css'
import './styles/base.css'
import './styles/chamber.css'
import './styles/ritual.css'
import './styles/archive.css'
import './styles/settings.css'

import { ArcanumApp } from './ui/app'

const stage = document.getElementById('stage')
const nav = document.getElementById('nav')
const live = document.getElementById('live')
const canvas = document.getElementById('field')

if (
  stage instanceof HTMLElement &&
  nav instanceof HTMLElement &&
  live instanceof HTMLElement &&
  canvas instanceof HTMLCanvasElement
) {
  const app = new ArcanumApp({ stage, nav, live, canvas })

  // The first gesture anywhere is what permits audio to exist at all. Both
  // listeners are removed together, whichever one fires first.
  const unlock = () => {
    document.removeEventListener('pointerdown', unlock)
    document.removeEventListener('keydown', unlock)
    if (app.settings.sound) void app.audio.awaken()
  }
  document.addEventListener('pointerdown', unlock, { passive: true })
  document.addEventListener('keydown', unlock)
}

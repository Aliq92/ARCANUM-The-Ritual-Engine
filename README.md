# ARCANUM // The Ritual Engine

A contemplative ritual instrument that runs entirely in the browser.

You choose an intent on a dial, choose how long you can stay, and the
instrument takes you through a short ceremony: an opening phrase, guided
breath, an authored invocation revealed one line at a time, a timed silence,
and finally one concrete action to carry back into the day. Completing a
ritual leaves a procedurally drawn sigil in a local archive.

It is a static site. There is no backend, no account, no network request
after the page loads, and nothing you do leaves your browser.

---

## What it is, plainly

ARCANUM is a focus and reflection tool built out of the things that
demonstrably help: paced breathing, narrowed attention, deliberate silence,
repetition, and committing to one small real-world action at the end.

The atmosphere is deliberately old, dark and ceremonial, because that
framing makes people slow down and pay attention. **It does not cause
supernatural effects, and nothing in it should be taken as a claim that it
does.** The rituals are original writing. None of it is presented as
scripture, as a historical incantation, or as a sacred text of any
tradition.

Every ritual in the library is directed at protection, resilience, healing,
clarity, grounding, patience, discipline, courage, reflection or focus.
There is nothing here for acting on another person, and a test in the suite
enforces that.

ARCANUM is not therapy and is not a medical device. If you are struggling
with your mental health, please talk to a qualified professional.

---

## The six intents

| Intent | For | How the instrument behaves |
| --- | --- | --- |
| **GUARD** | protection, boundaries, courage, steadiness | rings close inward and hold |
| **STILL** | calm, grounding, quieting mental noise | movement slows and settles |
| **MEND** | recovery, patience, restoration | broken forms travel back together |
| **CLEAR** | releasing distraction, resentment, clutter | the unnecessary dissolves away |
| **SEEK** | insight, reflection, difficult decisions | orbits turn and gradually align |
| **RESOLVE** | discipline, commitment, finishing | fragments lock onto one axis |

Each intent carries 13 hand-authored ritual variants — **78 in total**. Each
variant has its own opening phrase, invocation, breath patterns, silence
durations and grounding actions.

Three intensities: **Whisper** (~1 min), **Ritual** (~3 min, the recommended
default) and **Deep** (~5 min).

---

## Development

Requires Node 20 or newer.

```bash
npm install
npm run dev        # development server
npm test           # Vitest suite
npm run lint       # TypeScript typecheck (tsc --noEmit)
npm run build      # typecheck, then production build into dist/
npm run preview    # serve the production build locally
```

There are no runtime dependencies. The whole application is TypeScript,
modern CSS, SVG, one small canvas, the Web Audio API, the Vibration API and
`localStorage`.

### Layout

```
src/
  rituals/    the authored content library and its types
  engine/     state machine, timers, session planning, resonance
  visuals/    intent dial, core geometry, particle field, sigil generator
  audio/      procedural ambience and haptics
  ui/         one module per view, plus the application shell
  storage/    validated localStorage for the archive and settings
  styles/     design tokens and per-area stylesheets
```

---

## Tests

```bash
npm test
```

The suite covers logic rather than pixels:

- **Content** — every one of the 78 definitions is walked and validated:
  unique ids and titles, well-formed openings and invocations, usable breath
  patterns, concrete grounding actions, ascending silence durations, plus
  checks that nothing reads as coercive or as impersonated scripture.
- **State machine** — stages advance in order, illegal and duplicate
  transitions are refused, and only one session can be active at a time.
- **Timers** — every timer is owned by a group that can cancel all of them,
  so a restarted stage cannot stack.
- **Storage** — round-trips, malformed JSON, invalid records, and storage
  being entirely unavailable.
- **Sigils** — the same seed always produces identical geometry, different
  seeds and intents diverge, and every intent keeps its geometric bias.

---

## Deployment

`.github/workflows/deploy.yml` installs, typechecks, tests, builds and
publishes `dist/` to GitHub Pages on every push to `main`. **The deploy job
only runs if the tests pass.**

To enable it once per repository: **Settings → Pages → Build and deployment
→ Source: GitHub Actions**.

The build uses a **relative base path** (`./`), so the same `dist/` works at
a domain root, under a repository subpath such as
`https://<user>.github.io/<repo>/`, or opened from disk. If you need an
absolute base instead, set `BASE_PATH` at build time:

```bash
BASE_PATH=/my-subpath/ npm run build
```

---

## Browser support

Targets current Android Chrome and iOS Safari, plus current desktop Chrome,
Safari, Firefox and Edge. It needs ES2020, CSS custom properties, `dvh`
units and Pointer Events.

Two capabilities degrade rather than break:

- **Audio** requires the Web Audio API and a user gesture. If the browser
  refuses it, the ritual runs silently.
- **Haptics** require `navigator.vibrate`, which iOS does not implement. Where
  it is missing, haptics are skipped without errors.

If `localStorage` is unavailable or blocked, rituals still run — they simply
are not archived, and Settings says so.

---

## Accessibility

- `prefers-reduced-motion` is honoured, and Motion can be forced to Reduced
  in Settings regardless of the system setting.
- Reduced motion stops looping and drifting animation and replaces it with
  light and opacity. The breath indicator remains as a restrained scale,
  because it is the instruction rather than decoration.
- The dial is a real focusable control: arrow keys turn it, and each mark is
  a button with an accessible name.
- Stage changes and invocation lines are announced through a live region.
- Touch targets are at least 44px.

---

## Privacy

Everything is stored in your own browser under `arcanum.archive.v1` and
`arcanum.settings.v1`. Nothing is transmitted anywhere. **Settings → Reset
archive** deletes it, behind a deliberate confirmation step.

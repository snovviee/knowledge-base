import { act } from '@testing-library/react'

// A stand-in for the browser's window.matchMedia in every frontend test
// (features/25_responsive_layout). jsdom has no matchMedia and no layout. src/test/setup.ts
// assigns it to window.matchMedia, not with vi.stubGlobal, because most test files call
// vi.unstubAllGlobals(), and sets the width back to 1280 px after each test, so every test sees
// the wide layout unless it sets a width with setWindowWidth.

// The width every test starts with, in CSS pixels.
const WIDE_WIDTH = 1280

// The window's width, in CSS pixels, as the queries read it.
let width = WIDE_WIDTH

// The forms of query the stand-in answers; any other query matches nothing.
const QUERIES: { pattern: RegExp; matches: (width: number, limit: number) => boolean }[] = [
  { pattern: /^\(width < (\d+(?:\.\d+)?)px\)$/, matches: (current, limit) => current < limit },
  { pattern: /^\(max-width: (\d+(?:\.\d+)?)px\)$/, matches: (current, limit) => current <= limit },
  { pattern: /^\(min-width: (\d+(?:\.\d+)?)px\)$/, matches: (current, limit) => current >= limit },
]

function matchesAt(query: string, current: number): boolean {
  for (const { pattern, matches } of QUERIES) {
    const found = pattern.exec(query.trim())
    if (found) return matches(current, Number(found[1]))
  }
  return false
}

// The lists that were given a change listener: setWindowWidth tells each one whose answer changes.
const listening = new Set<FakeMediaQueryList>()

type ChangeListener = (event: MediaQueryListEvent) => void

// One query's answer, read at the current width, with its change event.
class FakeMediaQueryList extends EventTarget {
  readonly media: string
  onchange: ChangeListener | null = null

  constructor(media: string) {
    super()
    this.media = media
  }

  get matches(): boolean {
    return matchesAt(this.media, width)
  }

  addEventListener(...args: Parameters<EventTarget['addEventListener']>): void {
    listening.add(this)
    super.addEventListener(...args)
  }

  // The older names of the same calls, which some code still uses.
  addListener(listener: ChangeListener): void {
    this.addEventListener('change', listener as EventListener)
  }

  removeListener(listener: ChangeListener): void {
    this.removeEventListener('change', listener as EventListener)
  }

  fireChange(): void {
    const event = Object.assign(new Event('change'), { matches: this.matches, media: this.media })
    this.onchange?.(event as unknown as MediaQueryListEvent)
    this.dispatchEvent(event)
  }
}

export function matchMedia(query: string): MediaQueryList {
  return new FakeMediaQueryList(query) as unknown as MediaQueryList
}

function applyWidth(px: number): void {
  width = px
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px })
}

// Sets the window's width, as a resized window or a turned phone does: window.innerWidth and
// every query's answer follow it, and each query whose answer changes fires "change". It runs
// inside act, so the page has drawn the new layout when it returns.
export function setWindowWidth(px: number): void {
  act(() => {
    const before = new Map([...listening].map((list) => [list, list.matches]))
    applyWidth(px)
    for (const [list, matched] of before) {
      if (list.matches !== matched) list.fireChange()
    }
  })
}

// The wide default, with no list left listening: src/test/setup.ts calls it after each test,
// once the page is unmounted.
export function resetWindowWidth(): void {
  listening.clear()
  applyWidth(WIDE_WIDTH)
}

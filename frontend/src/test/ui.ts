// Helpers for the tests of the UI's looks (features/24_ui_states). jsdom applies no CSS, so
// they read the Tailwind classes that give an element its look. The Verify walkthrough checks
// the real look in a browser.

// The classes of an element, in its order.
const classesOf = (element: Element): string[] => [...element.classList]

// A class with a variant, such as hover:bg-slate-100 or aria-invalid:border-red-600: it
// applies only in a state, so it is not part of the element's look at rest.
const hasVariant = (name: string) => /^[^[]*:/.test(name)

// A text color utility, such as text-slate-600 or text-white; not a size (text-sm) or an
// alignment (text-left).
const isTextColor = (utility: string) =>
  /^text-(white|black|transparent|current|inherit|[a-z]+-\d{2,3}(\/\d+)?)$/.test(utility)

// The buttons, links with an address, inputs other than hidden ones, drop-down lists, and
// text areas under root that are shown (no ancestor with the hidden attribute) and not
// disabled, in document order: every element the user can choose with the pointer or reach
// with Tab (spec question 5).
export function interactiveElements(root: ParentNode): HTMLElement[] {
  const candidates = root.querySelectorAll<HTMLElement>(
    'button, a[href], input:not([type="hidden"]), select, textarea',
  )
  return [...candidates].filter((element) => element.closest('[hidden]') === null && !element.matches(':disabled'))
}

// The element's hover: classes that change its background, its border, its text color, its
// underline, or its decoration (spec question 5). For a checkbox, those of the <label> that
// holds it count too: a native checkbox draws its own box, so the change shows on its row.
export function hoverClasses(element: Element): string[] {
  const label = element.matches('input[type="checkbox"]') ? element.closest('label') : null
  const names = label ? [...classesOf(element), ...classesOf(label)] : classesOf(element)
  return names.filter((name) => {
    if (!name.startsWith('hover:')) return false
    const utility = name.slice('hover:'.length)
    return (
      utility.startsWith('bg-') ||
      /^border(-|$)/.test(utility) ||
      isTextColor(utility) ||
      utility === 'underline' ||
      utility.startsWith('decoration-')
    )
  })
}

// The classes that take the browser's own focus outline away.
const OUTLINE_REMOVERS = [
  'outline-none',
  'outline-hidden',
  'focus:outline-none',
  'focus:outline-hidden',
  'focus-visible:outline-none',
  'focus-visible:outline-hidden',
]

// A focus class that draws a ring or an outline of its own: a ring or an outline with a
// width, such as focus:ring-2 or focus-visible:outline-2. A color alone, such as
// focus:ring-slate-300, draws nothing.
const drawsFocus = (name: string) =>
  /^(focus|focus-visible):(ring|ring-[1-9]\d*|ring-\[[^\]]+\]|outline|outline-[1-9]\d*|outline-\[[^\]]+\]|outline-(solid|dashed|dotted|double))$/.test(
    name,
  )

// Whether the element shows a visible focus (spec question 5): it draws a focus ring or an
// outline of its own, or it keeps the browser's own outline, because no class takes it away.
export function keepsFocusVisible(element: Element): boolean {
  const names = classesOf(element)
  return names.some(drawsFocus) || !names.some((name) => OUTLINE_REMOVERS.includes(name))
}

// The look of an element, as its classes give it (spec question 4).
export type Look = {
  // From the nearest class on the element or an ancestor, or Tailwind's default when none
  // sets it: the sans family, the base size (16 px), and the normal weight.
  fontFamily: string
  fontSize: string
  fontWeight: string
  // Such as 'slate-600' or 'white', from the nearest class; null when none sets one.
  color: string | null
  // The element's own classes, each list sorted: padding such as ['px-3', 'py-1'], the
  // rounding, the border's width and color such as ['border', 'border-slate-300'], and the
  // background, such as 'bg-slate-900'.
  padding: string[]
  rounding: string | null
  border: string[]
  background: string | null
}

const FONT_SIZE = /^text-(xs|sm|base|lg|[2-9]?xl)(\/.+)?$/
const FONT_WEIGHT = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/
const FONT_FAMILY = /^font-(sans|serif|mono)$/

// The value of the nearest class on the element or an ancestor that matches, with its
// prefix (such as 'text-') taken off; classes with a variant are left out.
function nearest(element: Element, matches: (name: string) => boolean, prefix: string): string | null {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const found = classesOf(current).find((name) => !hasVariant(name) && matches(name))
    if (found) return found.slice(prefix.length).replace(/\/.+$/, '')
  }
  return null
}

// The element's own classes that match, without a variant, sorted.
const ownClasses = (element: Element, pattern: RegExp) =>
  classesOf(element)
    .filter((name) => !hasVariant(name) && pattern.test(name))
    .sort()

// The look of an element: its font family, size, weight, and text color, each from the
// nearest class on it or an ancestor, and its own padding, rounding, border, and background.
// Classes with a variant (hover:, focus:, disabled:, aria-…:) are left out.
export function lookOf(element: Element): Look {
  return {
    fontFamily: nearest(element, (name) => FONT_FAMILY.test(name), 'font-') ?? 'sans',
    fontSize: nearest(element, (name) => FONT_SIZE.test(name), 'text-') ?? 'base',
    fontWeight: nearest(element, (name) => FONT_WEIGHT.test(name), 'font-') ?? 'normal',
    color: nearest(element, isTextColor, 'text-'),
    padding: ownClasses(element, /^p[xytrblse]?-/),
    rounding: ownClasses(element, /^rounded(-|$)/)[0] ?? null,
    border: ownClasses(element, /^border(-|$)/),
    background: ownClasses(element, /^bg-/)[0] ?? null,
  }
}

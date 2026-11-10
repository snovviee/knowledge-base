import { useSyncExternalStore } from 'react'

// A window narrower than 768 CSS pixels is narrow (features/25_responsive_layout question 1).
// The range syntax makes a fractional width such as 767.5 px narrow, which (max-width: 767px)
// would not. The layout reads this hook instead of Tailwind's md: variants, whose breakpoints
// are in rem and so move with the browser's font size.
const NARROW_QUERY = '(width < 768px)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const isNarrow = () => window.matchMedia(NARROW_QUERY).matches

// Whether the window is narrow now. A change of width draws the page again at once, with no
// reload (spec question 10).
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, isNarrow)
}

// A note's review schedule as the UI writes it (features/12_review_interval_setting).

// The review intervals, by the values the API gives them, with their labels in the
// form, in the form's order (spec questions 15 and 18).
export const REVIEW_INTERVALS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Every N days' },
] as const

export type ReviewInterval = (typeof REVIEW_INTERVALS)[number]['value']

// The interval as the detail writes it: "Weekly", or "Every 10 days" for a custom number
// of days, and "Every 1 day" for one (spec questions 14 and 18).
export function intervalLabel(interval: ReviewInterval, days: number | null): string {
  if (interval === 'custom') return days === 1 ? 'Every 1 day' : `Every ${days} days`
  return REVIEW_INTERVALS.find((choice) => choice.value === interval)?.label ?? 'None'
}

// The dates are calendar dates, so they are written in UTC: no browser zone moves them.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// A review date as the API writes it, "2026-11-16", as the UI writes it: "Nov 16, 2026"
// (spec question 3). The date is built from its own year, month, and day.
export function formatReviewDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return DATE_FORMAT.format(new Date(Date.UTC(year, month - 1, day)))
}

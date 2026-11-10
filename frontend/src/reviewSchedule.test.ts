import { describe, expect, it } from 'vitest'
import { REVIEW_INTERVALS, formatReviewDate, intervalLabel } from './reviewSchedule'

// features/12_review_interval_setting. How the UI writes a note's review schedule.
describe('review schedule (features/12_review_interval_setting)', () => {
  it('AC-12 review dates are written like Nov 16, 2026, and intervals with their labels', () => {
    expect(formatReviewDate('2026-11-16')).toBe('Nov 16, 2026')
    expect(formatReviewDate('2026-01-01')).toBe('Jan 1, 2026')
    expect(formatReviewDate('2026-12-31')).toBe('Dec 31, 2026')

    // The form's choices, in the API's values.
    expect(REVIEW_INTERVALS.map(({ value, label }) => [value, label])).toEqual([
      ['none', 'None'],
      ['daily', 'Daily'],
      ['weekly', 'Weekly'],
      ['monthly', 'Monthly'],
      ['custom', 'Every N days'],
    ])

    // The detail's label of a note's interval.
    expect(intervalLabel('none', null)).toBe('None')
    expect(intervalLabel('daily', null)).toBe('Daily')
    expect(intervalLabel('weekly', null)).toBe('Weekly')
    expect(intervalLabel('monthly', null)).toBe('Monthly')
    expect(intervalLabel('custom', 10)).toBe('Every 10 days')
    expect(intervalLabel('custom', 1)).toBe('Every 1 day')
  })
})

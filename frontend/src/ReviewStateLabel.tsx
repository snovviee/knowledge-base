import type { NoteSummary } from './Notes'

type ReviewState = NonNullable<NoteSummary['review_state']>

// The label of each review state: its words and its look. "Due today" is amber
// (features/15_review_due_today question 3), and "Overdue" red, a warning
// (features/16_review_overdue question 1).
const LABELS: Record<ReviewState, { text: string; look: string }> = {
  due_today: { text: 'Due today', look: 'bg-amber-100 text-amber-900' },
  overdue: { text: 'Overdue', look: 'bg-red-100 text-red-800' },
}

// A note's review state as a label, in its list entry and in its detail's "Next review" row:
// "Due today", "Overdue", or nothing for a note that is neither. It comes from the server's
// review_state alone; the app never computes it. It starts with a space, so the text reads
// "Next review: Nov 9, 2026 Due today".
function ReviewStateLabel({ state }: { state?: ReviewState | null }) {
  const label = state ? LABELS[state] : undefined
  if (!label) return null
  return (
    <>
      {' '}
      <span data-testid="note-review-state" className={`rounded px-1.5 py-0.5 text-xs font-medium ${label.look}`}>
        {label.text}
      </span>
    </>
  )
}

export default ReviewStateLabel

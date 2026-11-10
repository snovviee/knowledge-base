// The address of the notes list request (features/15_review_due_today question 4;
// features/17_search_and_filter question 12): GET /api/notes, with the search and each
// filter that is not at "All" as a query parameter, such as /api/notes?review=due_today. An
// empty search and a filter at "All" are left out, so with nothing set the address is
// /api/notes, as before the filters.

// The "Review" choice: "" for "All", or the review state the server keeps: due today
// (features/15_review_due_today), overdue (features/16_review_overdue), or due in the next 7
// days or with no review scheduled (features/17_search_and_filter questions 7 and 8).
export type ReviewFilter = '' | 'due_today' | 'overdue' | 'next_7_days' | 'unscheduled'

// The "Status" choice: "" for "All", or the status the notes must have
// (features/17_search_and_filter question 1).
export type StatusFilter = '' | 'active' | 'archived'

// The choices of the bar's drop-down lists, "" for "All" in each: the id of a collection and
// of a tag as the list holds it, the status, and the review state.
export type FilterChoices = { collectionId: string; tagId: string; status: StatusFilter; review: ReviewFilter }

// Every drop-down list at "All".
export const ALL_CHOICES: FilterChoices = { collectionId: '', tagId: '', status: '', review: '' }

// The search, as tidied (see tidySearch), and the choices. A parameter that is empty, or at
// "All", is left out: it does not filter (features/17_search_and_filter question 12).
export type NoteListFilters = FilterChoices & { search: string }

// The search text as the server tidies it (features/17_search_and_filter question 13): the
// ends trimmed, and each run of whitespace inside one space.
export function tidySearch(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

// The parameters go in this order: search, collection_id, tag_id, status, review.
export function notesAddress(filters: NoteListFilters): string {
  const query = new URLSearchParams()
  if (filters.search) query.set('search', filters.search)
  if (filters.collectionId) query.set('collection_id', filters.collectionId)
  if (filters.tagId) query.set('tag_id', filters.tagId)
  if (filters.status) query.set('status', filters.status)
  if (filters.review) query.set('review', filters.review)
  const queryText = query.toString()
  return queryText ? `/api/notes?${queryText}` : '/api/notes'
}

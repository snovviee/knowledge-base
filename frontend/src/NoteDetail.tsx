import { useCallback, useEffect, useRef, useState } from 'react'
import { sendWithCsrfToken } from './api'
import ReviewStateLabel from './ReviewStateLabel'
import { formatReviewDate, intervalLabel } from './reviewSchedule'
import { applyTagChanges } from './tagChanges'
import type { NoteSummary } from './Notes'

// A whole note, as its detail shows it (GET /api/notes/:id, features/09_notes_crud).
export type Note = NoteSummary & { body: string; source_url: string | null }

type DetailState =
  | { status: 'loading' }
  // No answer, or an error answer: the note could not load.
  | { status: 'error' }
  | { status: 'ready'; note: Note }
  // A 404: the note was deleted elsewhere, for example in another tab.
  | { status: 'gone' }

// Asks for the note each time its detail opens, and on "Try again", so it shows the
// note as the server has it. A 401 means the sign-in has ended.
async function fetchNote(id: number): Promise<DetailState | 'signed-out'> {
  try {
    const res = await fetch(`/api/notes/${id}`)
    if (res.status === 401) return 'signed-out'
    if (res.status === 404) return { status: 'gone' }
    if (!res.ok) return { status: 'error' }
    const body = (await res.json()) as { note: Note }
    return { status: 'ready', note: body.note }
  } catch {
    return { status: 'error' }
  }
}

type NoteDetailProps = {
  id: number
  // The note as a create or a save just returned it, so it needs no request.
  note?: Note
  // "Back to notes": the list shows again.
  onBack: () => void
  // "Edit": the edit form shows in place of the detail.
  onEdit: (note: Note) => void
  // The server changed the note, for example archived it: the list shows the change.
  onChanged: (note: Note) => void
  // The note no longer exists (a 404): the notes area takes it off its list.
  onGone: (id: number) => void
  // This tab deleted the note (a 204): the notes area takes it off its list, with no alert.
  onDeleted: (id: number) => void
  // A request answered 401: the app shows the sign-in screen (features/06_collections_crud question 13).
  onSignedOut: () => void
  // The collections renamed in the collections area, by id: this note shows its
  // collection's new name, with no request.
  renamedCollections: Record<number, string>
  // The tags renamed or deleted in the tags area (features/10_note_tags).
  changedTags: Record<number, string | null>
}

// The note as it shows the renamed collections: its collection carries the new name, if
// it was renamed. The stored note is unchanged, so this is shown at render time
// (features/09_notes_crud).
function withCollectionRename(note: Note, renamed: Record<number, string>): Note {
  const name = renamed[note.collection.id]
  return name === undefined ? note : { ...note, collection: { id: note.collection.id, name } }
}

// A note's detail, in place of the list (features/09_notes_crud question 1): its title,
// collection, source URL, and body, and its actions.
function NoteDetail({
  id,
  note,
  onBack,
  onEdit,
  onChanged,
  onGone,
  onDeleted,
  onSignedOut,
  renamedCollections,
  changedTags,
}: NoteDetailProps) {
  const [detail, setDetail] = useState<DetailState>(note ? { status: 'ready', note } : { status: 'loading' })
  const titleRef = useRef<HTMLHeadingElement>(null)
  // Whether the detail was given its note when it opened. It is read once.
  const [given] = useState(note !== undefined)
  // An archive is waiting for the server: its button is busy and takes no second click.
  const [busy, setBusy] = useState(false)
  // The failure message of the last archive or restore, if it failed.
  const [changeFailure, setChangeFailure] = useState<string | null>(null)
  // How the last review ended, if one did: "Marked as reviewed." or its failure shows
  // (features/13_mark_reviewed question 6).
  const [reviewResult, setReviewResult] = useState<'reviewed' | 'failed' | null>(null)
  // A review is waiting for the server: its button is busy and takes no second click.
  const [reviewing, setReviewing] = useState(false)
  // The delete question is open: the actions give way to it (features/09_notes_crud question 12).
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // The delete is waiting for the server: its button is busy and takes no second click.
  const [deleting, setDeleting] = useState(false)
  // The failure message of the last delete, if it failed.
  const [deleteFailure, setDeleteFailure] = useState<string | null>(null)

  // The note's tags with the tags area's changes applied (features/10_note_tags).
  const tagsShown = applyTagChanges(detail.status === 'ready' ? detail.note.tags : [], changedTags)

  // Shows the answer of a read: a 401 hands over to the sign-in screen instead.
  const showRead = useCallback(
    (answer: DetailState | 'signed-out') => {
      if (answer === 'signed-out') onSignedOut()
      else setDetail(answer)
    },
    [onSignedOut],
  )

  useEffect(() => {
    if (!given) fetchNote(id).then(showRead)
  }, [id, given, showRead])

  useEffect(() => {
    if (detail.status === 'gone') onGone(id)
  }, [detail.status, id, onGone])


  // Archives or restores the note at once, with no question first: each undoes the
  // other (features/09_notes_crud question 12). The edit sends only the status
  // (question 9). A 404 means the note was deleted elsewhere: the list takes it off.
  // No answer, or any other error answer, shows the failure and keeps the detail
  // (features/06_collections_crud question 12).
  const changeStatus = async (status: 'active' | 'archived') => {
    const failed = status === 'archived' ? 'Could not archive the note. Try again.' : 'Could not restore the note. Try again.'
    setBusy(true)
    setChangeFailure(null)
    try {
      const res = await sendWithCsrfToken('PATCH', `/api/notes/${id}`, { status })
      if (res.status === 401) {
        onSignedOut()
        return
      }
      if (res.status === 404) {
        setDetail({ status: 'gone' })
        return
      }
      if (!res.ok) {
        setChangeFailure(failed)
        return
      }
      const answer = (await res.json()) as { note: Note }
      setDetail({ status: 'ready', note: answer.note })
      onChanged(answer.note)
    } catch {
      setChangeFailure(failed)
    } finally {
      setBusy(false)
    }
  }

  // Marks the note as reviewed today (features/13_mark_reviewed questions 5 and 6). The
  // request has no body: the server decides the dates. The detail shows the answer's note,
  // and the list takes it in the note's place, so the list shows the new next review date
  // (features/14_review_date_recalc). Starting a review removes the last one's message. A
  // 401 shows the sign-in screen. A 404 means the note was deleted elsewhere: the list takes
  // it off, as for an archive. No answer, or any other error answer, shows the failure and
  // keeps the detail and the list as they were.
  const markReviewed = async () => {
    setReviewing(true)
    setReviewResult(null)
    try {
      const res = await sendWithCsrfToken('POST', `/api/notes/${id}/review`)
      if (res.status === 401) {
        onSignedOut()
        return
      }
      if (res.status === 404) {
        setDetail({ status: 'gone' })
        return
      }
      if (!res.ok) {
        setReviewResult('failed')
        return
      }
      const answer = (await res.json()) as { note: Note }
      setDetail({ status: 'ready', note: answer.note })
      onChanged(answer.note)
      setReviewResult('reviewed')
    } catch {
      setReviewResult('failed')
    } finally {
      setReviewing(false)
    }
  }

  const retryNote = () => {
    setDetail({ status: 'loading' })
    fetchNote(id).then(showRead)
  }

  // Deletes the note once the user has confirmed it. A 204 removes it from the list with
  // no alert. A 404 means it was already deleted elsewhere, which the list says
  // (features/09_notes_crud question 12; features/06_collections_crud question 12).
  // No answer, or any other error answer, shows the failure and keeps the confirmation.
  const deleteNote = async () => {
    setDeleting(true)
    setDeleteFailure(null)
    try {
      const res = await sendWithCsrfToken('DELETE', `/api/notes/${id}`)
      if (res.status === 401) onSignedOut()
      // Gone already (a 404) or deleted here (a 204): both leave the list with no alert.
      else if (res.status === 404 || res.ok) onDeleted(id)
      else setDeleteFailure('Could not delete the note. Try again.')
    } catch {
      setDeleteFailure('Could not delete the note. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  // An opened detail puts the focus on the note's title.
  useEffect(() => {
    if (detail.status === 'ready') titleRef.current?.focus()
  }, [detail.status])

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={onBack}
        className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        Back to notes
      </button>
      {detail.status === 'loading' && (
        <p role="status" className="text-sm text-slate-600">
          Loading…
        </p>
      )}
      {detail.status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-red-700">
            Could not load the note. Try again.
          </p>
          <button
            type="button"
            onClick={retryNote}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      )}
      {detail.status === 'ready' && (
        <article className="flex w-full flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 ref={titleRef} tabIndex={-1} className="min-w-0 text-lg font-semibold wrap-anywhere focus:outline-none">
              {detail.note.title}
            </h3>
            {detail.note.status === 'archived' && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">Archived</span>
            )}
          </div>
          {/* A long name or address breaks inside its line (features/25_responsive_layout question 9). */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm wrap-anywhere">
            <dt className="text-slate-600">Collection</dt>
            <dd>{withCollectionRename(detail.note, renamedCollections).collection.name}</dd>
            <dt className="text-slate-600">Tags</dt>
            <dd>{tagsShown.length > 0 ? tagsShown.map((tag) => tag.name).join(', ') : 'No tags'}</dd>
            {/* The review schedule (features/12_review_interval_setting questions 14, 16, and 18). */}
            <dt className="text-slate-600">Review interval</dt>
            <dd>{intervalLabel(detail.note.review_interval ?? 'none', detail.note.review_interval_days ?? null)}</dd>
            <dt className="text-slate-600">Next review</dt>
            <dd>
              {detail.note.next_review_date ? formatReviewDate(detail.note.next_review_date) : 'Not set'}
              {/* The review state of the note as the server last answered it (features/15_review_due_today question 3). */}
              <ReviewStateLabel state={detail.note.review_state} />
            </dd>
            {/* The last review, or Never (features/13_mark_reviewed question 7). */}
            <dt className="text-slate-600">Last reviewed</dt>
            <dd>{detail.note.last_reviewed_date ? formatReviewDate(detail.note.last_reviewed_date) : 'Never'}</dd>
            {detail.note.source_url && (
              <>
                <dt className="text-slate-600">Source URL</dt>
                <dd>
                  <a
                    href={detail.note.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    {detail.note.source_url}
                  </a>
                </dd>
              </>
            )}
          </dl>
          <p data-testid="note-body" className="whitespace-pre-wrap text-sm wrap-anywhere">
            {detail.note.body}
          </p>
          {changeFailure && (
            <p role="alert" className="text-sm text-red-700">
              {changeFailure}
            </p>
          )}
          {reviewResult === 'failed' && (
            <p role="alert" className="text-sm text-red-700">
              Could not mark the note as reviewed. Try again.
            </p>
          )}
          {reviewResult === 'reviewed' && (
            <p role="status" className="text-sm text-green-700">
              Marked as reviewed.
            </p>
          )}
          {confirmingDelete ? (
            <div
              role="group"
              aria-label={`Delete “${detail.note.title}”`}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setConfirmingDelete(false)
              }}
              className="flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-2"
            >
              <p className="text-sm text-slate-900 wrap-anywhere">Delete “{detail.note.title}”? This cannot be undone.</p>
              {deleteFailure && (
                <p role="alert" className="text-sm text-red-700">
                  {deleteFailure}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={deleteNote}
                  disabled={deleting}
                  aria-busy={deleting}
                  className="rounded bg-red-700 px-3 py-1 text-sm text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
                >
                  Delete
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={markReviewed}
                disabled={reviewing}
                aria-busy={reviewing}
                className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              >
                Mark as reviewed
              </button>
              <button
                type="button"
                onClick={() => onEdit(detail.note)}
                className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => changeStatus(detail.note.status === 'archived' ? 'active' : 'archived')}
                disabled={busy}
                aria-busy={busy}
                className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              >
                {detail.note.status === 'archived' ? 'Restore' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Delete
              </button>
            </div>
          )}
        </article>
      )}
    </div>
  )
}

export default NoteDetail

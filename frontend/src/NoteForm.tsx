import { type ReactNode, type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react'
import { sendWithCsrfToken } from './api'
import type { NamedRecord } from './NameListArea'
import type { Note } from './NoteDetail'
import NoteTags from './NoteTags'
import { REVIEW_INTERVALS, type ReviewInterval } from './reviewSchedule'

type CollectionsState =
  | { status: 'loading' }
  // No answer, or an error answer: the collections could not load.
  | { status: 'error' }
  | { status: 'ready'; collections: NamedRecord[] }

// The user's collections for the "Collection" field, in the server's order:
// alphabetical, ignoring case (features/06_collections_crud question 8). Asked when the
// form opens and on "Try again". A 401 means the sign-in has ended.
async function fetchCollections(): Promise<CollectionsState | 'signed-out'> {
  try {
    const res = await fetch('/api/collections')
    if (res.status === 401) return 'signed-out'
    if (!res.ok) return { status: 'error' }
    const body = (await res.json()) as { collections: NamedRecord[] }
    return { status: 'ready', collections: body.collections }
  } catch {
    return { status: 'error' }
  }
}

// The fields of the form, by the names the API gives them, in the form's order.
const FIELDS = [
  'title',
  'body',
  'source_url',
  'collection_id',
  'review_interval',
  'review_interval_days',
  'next_review_date',
] as const
type Field = (typeof FIELDS)[number]

// One code for each field that breaks a rule, as the server's 422 answer names them
// (features/09_notes_crud question 8).
type FieldCodes = Partial<Record<Field, string>>

// The message under a field, by its code (spec question 7).
const MESSAGES: Record<Field, Record<string, string>> = {
  title: { blank: 'Enter a title.', too_long: 'Use at most 200 characters.' },
  body: { blank: 'Enter a body.', too_long: 'Use at most 100,000 characters.' },
  source_url: {
    invalid: 'Enter a URL that starts with http:// or https://.',
    too_long: 'Use at most 2,000 characters.',
  },
  collection_id: {
    blank: 'Choose a collection.',
    // Not one of the user's collections, for example one deleted in another tab.
    not_found: 'This collection no longer exists. Choose another.',
  },
  // features/12_review_interval_setting question 13. The server refuses an interval it
  // does not know; the form offers only the ones it knows.
  review_interval: { invalid: 'Choose a review interval.' },
  review_interval_days: {
    blank: 'Enter the number of days.',
    invalid: 'Enter a whole number from 1 to 365.',
  },
  next_review_date: { invalid: 'Enter a valid date.' },
}

// The server's pattern for a web address (Note::WEB_ADDRESS in backend/app/models/note.rb,
// spec question 5): http:// or https:// in any letter case, a host, and no spaces.
const WEB_ADDRESS = /^https?:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i

// Characters as the server counts them: by code point, so an emoji is one.
const characters = (text: string) => [...text].length

// The collection is the chosen collection's id, or '' while none is chosen. In the edit
// form it is the note's own until the user chooses another (features/11_note_move). The
// days are as typed, and dateBadInput says whether the date field holds something that is
// not a date, such as a date typed in part (features/12_review_interval_setting).
type NoteValues = {
  title: string
  body: string
  sourceUrl: string
  collection: string
  reviewInterval: ReviewInterval
  days: string
  dateBadInput: boolean
}

// The browser's checks, run when the user chooses "Create" or "Save" (spec question 6),
// with the server's rules and limits (questions 3 to 5). The server checks them again.
function checkNote({ title, body, sourceUrl, collection, reviewInterval, days, dateBadInput }: NoteValues): FieldCodes {
  const codes: FieldCodes = {}
  // The title is tidied as the server tidies it: the ends trimmed, inner whitespace one
  // space. The body is kept as typed.
  const tidyTitle = title.replace(/\s+/g, ' ').trim()
  if (tidyTitle === '') codes.title = 'blank'
  else if (characters(tidyTitle) > 200) codes.title = 'too_long'
  if (body.trim() === '') codes.body = 'blank'
  else if (characters(body) > 100_000) codes.body = 'too_long'
  const url = sourceUrl.trim()
  if (characters(url) > 2000) codes.source_url = 'too_long'
  else if (url !== '' && !WEB_ADDRESS.test(url)) codes.source_url = 'invalid'
  if (collection === '') codes.collection_id = 'blank'
  // "Every N days" needs its days: digits naming a whole number from 1 to 365
  // (features/12_review_interval_setting questions 5 and 13). A hidden field is not checked.
  if (reviewInterval === 'custom') {
    const typed = days.trim()
    if (typed === '') codes.review_interval_days = 'blank'
    else if (!/^\d+$/.test(typed) || Number(typed) < 1 || Number(typed) > 365) codes.review_interval_days = 'invalid'
  }
  // A schedule's date field that the browser cannot read as a date (question 13).
  if (reviewInterval !== 'none' && dateBadInput) codes.next_review_date = 'invalid'
  return codes
}

type ReviewValues = { reviewInterval: ReviewInterval; days: string; nextReviewDate: string }

// What a save sends of the review schedule (features/12_review_interval_setting question
// 17): each field only when it differs from the note's, and a new note counts as a note
// with no schedule. So a create sends the interval unless it is None, the number of days
// with "Every N days", and the date when one is entered, and a save that does not touch
// the schedule sends none of them, which keeps a date that another tab or a review
// changed meanwhile. A field the interval hides is never sent. The days go as a number,
// and an emptied date as null, which restarts the schedule from today (question 9).
function changedReviewFields({ reviewInterval, days, nextReviewDate }: ReviewValues, note: Note | undefined) {
  const intervalBefore = note?.review_interval ?? 'none'
  const fields: { review_interval?: ReviewInterval; review_interval_days?: number; next_review_date?: string | null } =
    {}
  if (reviewInterval !== intervalBefore) fields.review_interval = reviewInterval
  const dayCount = Number(days.trim())
  if (reviewInterval === 'custom' && (intervalBefore !== 'custom' || dayCount !== note?.review_interval_days)) {
    fields.review_interval_days = dayCount
  }
  if (reviewInterval !== 'none' && nextReviewDate !== (note?.next_review_date ?? '')) {
    fields.next_review_date = nextReviewDate === '' ? null : nextReviewDate
  }
  return fields
}

// A field's look. The hover background stays visible on a field marked invalid, whose red
// border wins over the hover border (features/24_ui_states question 3).
const fieldClass =
  'w-full rounded border border-slate-300 px-2 py-1 text-sm hover:border-slate-400 hover:bg-slate-50 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 aria-invalid:border-red-600'

// What ties a control to its label and to the message under it.
type ControlProps = { id: string; 'aria-invalid': true | undefined; 'aria-describedby': string | undefined }

type FormFieldProps = {
  label: string
  // The message under the field, when its value breaks a rule.
  message: string | undefined
  children: (props: ControlProps) => ReactNode
}

// A labelled field with its message under it. A field with a message is marked invalid.
function FormField({ label, message, children }: FormFieldProps) {
  const id = useId()
  const messageId = useId()

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      {children({ id, 'aria-invalid': message ? true : undefined, 'aria-describedby': message ? messageId : undefined })}
      {message && (
        <p id={messageId} role="alert" className="text-xs text-red-700">
          {message}
        </p>
      )}
    </div>
  )
}

type CollectionFieldProps = {
  collections: CollectionsState
  // The chosen collection's id, or '' while none is chosen.
  value: string
  onChange: (value: string) => void
  // The message under the field, when the chosen collection breaks a rule.
  message: string | undefined
  selectRef: RefObject<HTMLSelectElement | null>
  // "Try again" after the collections could not load.
  onRetry: () => void
}

// The "Collection" field, the same in the new-note and the edit form: a group named by
// its legend, which also labels the select. The edit form shows it at once, so the
// collections load in its place (features/11_note_move question 3), as the Tags group
// loads its tags (features/10_note_tags).
function CollectionField({ collections, value, onChange, message, selectRef, onRetry }: CollectionFieldProps) {
  const legendId = useId()
  const messageId = useId()

  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend id={legendId} className="mb-1 text-xs font-medium text-slate-600">
        Collection
      </legend>
      {collections.status === 'loading' && (
        <p role="status" className="text-sm text-slate-600">
          Loading…
        </p>
      )}
      {collections.status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-red-700">
            Could not load collections. Try again.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      )}
      {collections.status === 'ready' && (
        <div className="flex flex-col gap-1">
          <select
            ref={selectRef}
            aria-labelledby={legendId}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? messageId : undefined}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={fieldClass}
          >
            <option value="">Choose a collection</option>
            {collections.collections.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          {message && (
            <p id={messageId} role="alert" className="text-xs text-red-700">
              {message}
            </p>
          )}
        </div>
      )}
    </fieldset>
  )
}

type NoteFormProps = {
  // The note to edit. Without it, the form creates a note.
  note?: Note
  // The server saved the note: its detail shows.
  onSaved: (note: Note) => void
  // "Cancel": the view the form came from shows again.
  onCancel: () => void
  // A save answered 404: the note was deleted elsewhere.
  onGone?: () => void
  // A request answered 401: the app shows the sign-in screen (features/06_collections_crud question 13).
  onSignedOut: () => void
}

// The note form (features/09_notes_crud question 1): the new-note form in place of the
// list, or the edit form in place of the note's detail. The new-note form loads the
// user's collections first, so a note goes into the one the user chooses (question 10).
// With no collections, it says so before anything is typed (question 11). The edit form
// has the same Collection field, with the note's collection chosen: choosing another one
// moves the note (features/11_note_move).
function NoteForm({ note, onSaved, onCancel, onGone, onSignedOut }: NoteFormProps) {
  const editing = note !== undefined
  const [collections, setCollections] = useState<CollectionsState>({ status: 'loading' })
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [sourceUrl, setSourceUrl] = useState(note?.source_url ?? '')
  // The chosen collection's id, or '' while none is chosen. The edit form starts with the
  // note's own collection (features/11_note_move).
  const [collection, setCollection] = useState(note ? String(note.collection.id) : '')
  // The tags checked in the Tags group (features/10_note_tags).
  const [checkedTags, setCheckedTags] = useState<number[]>(note?.tags?.map((tag) => tag.id) ?? [])
  // The review schedule (features/12_review_interval_setting): the interval, the number of
  // days as typed, and the next review date as the date field holds it ("YYYY-MM-DD", or ''
  // while it is empty). A field the interval does not use is hidden and keeps its value.
  // The edit form starts with the note's schedule, and a new note with None (question 18).
  const [reviewInterval, setReviewInterval] = useState<ReviewInterval>(note?.review_interval ?? 'none')
  const [days, setDays] = useState(note?.review_interval_days != null ? String(note.review_interval_days) : '')
  const [nextReviewDate, setNextReviewDate] = useState(note?.next_review_date ?? '')
  // The Tags group, which reloads itself when a chosen tag no longer exists.
  const tagsRef = useRef<{ refuse: () => void } | null>(null)
  const [codes, setCodes] = useState<FieldCodes>({})
  // The failure message of the last try, if it got no answer or an error answer.
  const [failure, setFailure] = useState<string | null>(null)
  // The request is waiting: the submit button is busy and takes no second click.
  const [busy, setBusy] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const sourceUrlRef = useRef<HTMLInputElement>(null)
  const collectionRef = useRef<HTMLSelectElement>(null)
  const reviewIntervalRef = useRef<HTMLSelectElement>(null)
  const daysRef = useRef<HTMLInputElement>(null)
  const nextReviewDateRef = useRef<HTMLInputElement>(null)
  const headingId = useId()

  // Shows the collections answer: a 401 hands over to the sign-in screen instead.
  const showCollections = useCallback(
    (answer: CollectionsState | 'signed-out') => {
      if (answer === 'signed-out') onSignedOut()
      else setCollections(answer)
    },
    [onSignedOut],
  )

  useEffect(() => {
    fetchCollections().then(showCollections)
  }, [showCollections])

  const retryCollections = () => {
    setCollections({ status: 'loading' })
    fetchCollections().then(showCollections)
  }

  // Whether the checked tags differ from the note's tags, as the edit began (spec question 8).
  const tagsChanged = () => {
    const before = [...(note?.tags?.map((tag) => tag.id) ?? [])].sort((a, b) => a - b)
    const now = [...checkedTags].sort((a, b) => a - b)
    return before.length !== now.length || before.some((id, i) => id !== now[i])
  }

  // Whether another collection than the note's is chosen (features/11_note_move question 4).
  const collectionChanged = () => collection !== String(note?.collection.id)

  const messageFor = (field: Field) => {
    const code = codes[field]
    return code ? MESSAGES[field][code] : undefined
  }

  // Shows a message under each field that has a code, and puts the focus on the first
  // of them. Says whether any field has a code.
  const showCodes = (found: FieldCodes) => {
    setCodes(found)
    const first = FIELDS.find((field) => found[field])
    const refs = {
      title: titleRef,
      body: bodyRef,
      source_url: sourceUrlRef,
      collection_id: collectionRef,
      review_interval: reviewIntervalRef,
      review_interval_days: daysRef,
      next_review_date: nextReviewDateRef,
    }
    if (first) refs[first].current?.focus()
    return first !== undefined
  }

  // Sends the new note, or the edited fields of the note. The collection's id is a
  // number (spec question 8). A 422 shows the server's codes as the browser's check
  // shows its own. No answer, or any other error answer, shows the failure message and
  // keeps what was typed (features/06_collections_crud question 12).
  const saveNote = async () => {
    const failed = editing ? 'Could not save the note. Try again.' : 'Could not create the note. Try again.'
    setBusy(true)
    const review = changedReviewFields({ reviewInterval, days, nextReviewDate }, note)
    try {
      const res = editing
        ? await sendWithCsrfToken('PATCH', `/api/notes/${note.id}`, {
            title,
            body,
            source_url: sourceUrl,
            // A save sends the tags only when the checked set differs from the note's
            // (spec question 8), so a save that does not touch them keeps another tab's.
            ...(tagsChanged() ? { tag_ids: checkedTags } : {}),
            // A save sends the collection only when another one is chosen, so a save that
            // does not move the note, or one made before the collections load, keeps it
            // where it is (features/11_note_move questions 3 and 4).
            ...(collectionChanged() ? { collection_id: Number(collection) } : {}),
            // The review fields that changed (features/12_review_interval_setting question 17).
            ...review,
          })
        : await sendWithCsrfToken('POST', '/api/notes', {
            title,
            body,
            source_url: sourceUrl,
            collection_id: Number(collection),
            // A create sends the tags only when one is checked (spec question 8).
            ...(checkedTags.length > 0 ? { tag_ids: checkedTags } : {}),
            // The schedule, when one is chosen (features/12_review_interval_setting question 17).
            ...review,
          })
      if (res.status === 401) {
        onSignedOut()
        return
      }
      if (res.status === 404 && onGone) {
        onGone()
        return
      }
      if (res.status === 422) {
        const refused = (await res.json()) as { fields: FieldCodes & { tag_ids?: string } }
        // A chosen tag that no longer exists is shown under the Tags group (spec question 9).
        if (refused.fields.tag_ids === 'not_found') {
          setCodes({})
          tagsRef.current?.refuse()
          return
        }
        showCodes(refused.fields)
        return
      }
      if (!res.ok) {
        setFailure(failed)
        return
      }
      const answer = (await res.json()) as { note: Note }
      onSaved(answer.note)
    } catch {
      setFailure(failed)
    } finally {
      setBusy(false)
    }
  }

  // Checks the fields first: each field that breaks a rule shows its message, the focus
  // moves to the first of them, and nothing is sent (spec question 6).
  const submit = () => {
    setFailure(null)
    const dateBadInput = nextReviewDateRef.current?.validity.badInput ?? false
    if (showCodes(checkNote({ title, body, sourceUrl, collection, reviewInterval, days, dateBadInput }))) return
    saveNote()
  }

  // The fields show in the edit form, and in the new-note form once the user's
  // collections have loaded and there is one to choose.
  const fieldsShown = editing || (collections.status === 'ready' && collections.collections.length > 0)

  return (
    <form
      noValidate
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex w-full max-w-2xl flex-col gap-3"
    >
      <h3 id={headingId} className="text-lg font-semibold">
        {editing ? 'Edit note' : 'New note'}
      </h3>
      {!editing && collections.status === 'loading' && (
        <p role="status" className="text-sm text-slate-600">
          Loading…
        </p>
      )}
      {!editing && collections.status === 'error' && (
        <>
          <p role="alert" className="text-sm text-red-700">
            Could not load collections. Try again.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retryCollections}
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </>
      )}
      {!editing && collections.status === 'ready' && collections.collections.length === 0 && (
        <>
          <p className="text-sm text-slate-600">Create a collection first. Every note belongs to a collection.</p>
          <div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </>
      )}
      {fieldsShown && (
        <>
          <FormField label="Title" message={messageFor('title')}>
            {(props) => (
              <input
                {...props}
                ref={titleRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
                className={fieldClass}
              />
            )}
          </FormField>
          <FormField label="Body" message={messageFor('body')}>
            {(props) => (
              <textarea
                {...props}
                ref={bodyRef}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={8}
                className={fieldClass}
              />
            )}
          </FormField>
          <FormField label="Source URL (optional)" message={messageFor('source_url')}>
            {(props) => (
              <input
                {...props}
                ref={sourceUrlRef}
                type="text"
                inputMode="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                className={fieldClass}
              />
            )}
          </FormField>
          <CollectionField
            collections={collections}
            value={collection}
            onChange={setCollection}
            message={messageFor('collection_id')}
            selectRef={collectionRef}
            onRetry={retryCollections}
          />
          <NoteTags
            initialChecked={note?.tags?.map((tag) => tag.id) ?? []}
            onChange={setCheckedTags}
            onSignedOut={onSignedOut}
            refusalRef={tagsRef}
          />
          {/* The review schedule: "Number of days" shows only for "Every N days", and the date
              only for an interval other than None (features/12_review_interval_setting
              questions 7 and 18). */}
          <FormField label="Review interval" message={messageFor('review_interval')}>
            {(props) => (
              <select
                {...props}
                ref={reviewIntervalRef}
                value={reviewInterval}
                onChange={(event) => setReviewInterval(event.target.value as ReviewInterval)}
                className={fieldClass}
              >
                {REVIEW_INTERVALS.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          {reviewInterval === 'custom' && (
            <FormField label="Number of days" message={messageFor('review_interval_days')}>
              {(props) => (
                <input
                  {...props}
                  ref={daysRef}
                  type="text"
                  inputMode="numeric"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  className={fieldClass}
                />
              )}
            </FormField>
          )}
          {reviewInterval !== 'none' && (
            <FormField label="Next review date (optional)" message={messageFor('next_review_date')}>
              {(props) => (
                <input
                  {...props}
                  ref={nextReviewDateRef}
                  type="date"
                  value={nextReviewDate}
                  onChange={(event) => setNextReviewDate(event.target.value)}
                  className={fieldClass}
                />
              )}
            </FormField>
          )}
          {failure && (
            <p role="alert" className="text-sm text-red-700">
              {failure}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {editing ? 'Save' : 'Create'}
            </button>
            {/* Only "Cancel" closes the form: Escape does not (spec question 13). */}
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </form>
  )
}

export default NoteForm

import { type Ref, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { NamedRecord } from './NameListArea'
import NoteDetail, { type Note } from './NoteDetail'
import NoteFilters from './NoteFilters'
import NoteForm from './NoteForm'
import { ALL_CHOICES, type FilterChoices, type ReviewFilter, notesAddress, tidySearch } from './notesAddress'
import ReviewStateLabel from './ReviewStateLabel'
import { type ReviewInterval, formatReviewDate } from './reviewSchedule'
import { applyTagChanges } from './tagChanges'

// A note as the list shows it (GET /api/notes, features/09_notes_crud).
export type NoteSummary = {
  id: number
  title: string
  status: 'active' | 'archived'
  collection: { id: number; name: string }
  // The note's tags in alphabetical order; empty for a note with none (features/10_note_tags).
  tags: { id: number; name: string }[]
  // The review schedule (features/12_review_interval_setting question 15): the dates are
  // "YYYY-MM-DD", and the days a whole number while the interval is custom. An answer
  // without these fields reads as a note with no schedule.
  review_interval?: ReviewInterval
  review_interval_days?: number | null
  next_review_date?: string | null
  last_reviewed_date?: string | null
  // The review state on the user's today, as the server decides it (features/15_review_due_today
  // question 2). An answer without it reads as null: neither due today nor overdue.
  review_state?: 'due_today' | 'overdue' | null
  created_at: string
  updated_at: string
}

type ListState =
  | { status: 'loading' }
  // No answer, or an error answer: the list could not load.
  | { status: 'error' }
  | { status: 'ready'; notes: NoteSummary[] }
  // A 401: the sign-in has ended, so the app shows the sign-in screen
  // (features/06_collections_crud question 13).
  | { status: 'signed-out' }

// Asks for the user's notes, newest first, with the filters the address names
// (features/15_review_due_today).
async function fetchNotes(address: string): Promise<ListState> {
  try {
    const res = await fetch(address)
    if (res.status === 401) return { status: 'signed-out' }
    if (!res.ok) return { status: 'error' }
    const body = (await res.json()) as { notes: NoteSummary[] }
    return { status: 'ready', notes: body.notes }
  } catch {
    return { status: 'error' }
  }
}

// How long the search waits after the last change of the field (features/17_search_and_filter
// question 5).
const SEARCH_PAUSE_MS = 300

// A list answer, kept with the load it answers (see Notes).
type LoadedList = { load: string; list: ListState }

const LOADING: ListState = { status: 'loading' }

// The list without one note, for example a note that was deleted.
function withoutNote(list: ListState, id: number): ListState {
  return list.status === 'ready' ? { status: 'ready', notes: list.notes.filter((note) => note.id !== id) } : list
}

// The list with a changed note in its place, for example a saved or archived note.
function withNote(list: ListState, note: Note): ListState {
  return list.status === 'ready'
    ? { status: 'ready', notes: list.notes.map((listed) => (listed.id === note.id ? note : listed)) }
    : list
}

// The list as it shows the renamed collections: each note carries its collection's new
// name. The stored list is unchanged, so this is shown at render time (features/09_notes_crud).
function withRenames(list: ListState, renamed: Record<number, string>): ListState {
  if (list.status !== 'ready') return list
  return {
    status: 'ready',
    notes: list.notes.map((note) => {
      const name = renamed[note.collection.id]
      return name === undefined ? note : { ...note, collection: { id: note.collection.id, name } }
    }),
  }
}

// The list as the tags area changed them: a renamed tag shows its new name, and a deleted
// tag is dropped from each note (features/10_note_tags). Shown at render time.
function withTagChanges(list: ListState, changed: Record<number, string | null>): ListState {
  if (list.status !== 'ready' || Object.keys(changed).length === 0) return list
  return {
    status: 'ready',
    notes: list.notes.map((note) => ({ ...note, tags: applyTagChanges(note.tags, changed) })),
  }
}

// What the notes area shows: one view at a time, in place (spec question 1).
// A detail may come with its note, as a create just returned it. A detail shown by "Open" in
// the review reminders panel carries the number of that opening, part of the detail's key
// (features/20_realtime_notifications).
type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'detail'; id: number; note?: Note; opened?: number }
  | { kind: 'edit'; note: Note }

// What the notes area lets the app do: show a note's detail, as choosing its title in the
// list does, for "Open" in the review reminders panel (features/20_realtime_notifications
// question 6).
export type NotesHandle = { openNote: (id: number) => void }

type NoteListProps = {
  list: ListState
  // What an empty list says, which depends on the search and the filters.
  emptyText: string
  // An empty list offers "Clear search and filters" (features/17_search_and_filter question 11).
  clearable: boolean
  onClear: () => void
  onOpen: (id: number) => void
  onRetry: () => void
}

// What an empty list says with nothing but "Review" set, for each of its choices
// (features/15_review_due_today question 5; features/16_review_overdue question 3;
// features/17_search_and_filter question 11).
const EMPTY_TEXT: Record<ReviewFilter, string> = {
  '': 'No notes yet',
  due_today: 'No notes are due for review today.',
  overdue: 'No notes are overdue for review.',
  next_7_days: 'No notes are due for review in the next 7 days.',
  unscheduled: 'Every note has a review schedule.',
}

// What an empty list says with a search, a collection, a tag, or a status set, whatever
// "Review" shows (features/17_search_and_filter question 11).
const NO_MATCH_TEXT = 'No notes match your search and filters.'

// Whether the left area lists the record with this id; "" ("All") always counts as listed.
function listed(records: NamedRecord[] | null, id: string): boolean {
  return id === '' || (records ?? []).some((record) => String(record.id) === id)
}

// The list view: "Loading…", the load error with "Try again", the empty text, or the
// entries, each with its title (which opens the note), its collection, and "Archived"
// for an archived note.
function NoteList({ list, emptyText, clearable, onClear, onOpen, onRetry }: NoteListProps) {
  if (list.status === 'loading') {
    return (
      <p role="status" className="text-sm text-slate-600">
        Loading…
      </p>
    )
  }

  if (list.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-sm text-red-700">
          Could not load notes. Try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
        >
          Try again
        </button>
      </div>
    )
  }

  if (list.status !== 'ready') return null
  if (list.notes.length === 0 && !clearable) return <p className="text-sm text-slate-600">{emptyText}</p>
  if (list.notes.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-slate-600">{emptyText}</p>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          Clear search and filters
        </button>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {list.notes.map((note) => (
        <li key={note.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-3 text-sm">
          <button
            type="button"
            data-testid="note-title"
            onClick={() => onOpen(note.id)}
            className="min-w-0 text-left font-medium wrap-anywhere hover:underline focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {note.title}
          </button>
          <span data-testid="note-collection" className="min-w-0 text-slate-600 wrap-anywhere">
            {note.collection.name}
          </span>
          {(note.tags?.length ?? 0) > 0 && (
            <span data-testid="note-tags" className="min-w-0 text-slate-600 wrap-anywhere">
              {(note.tags ?? []).map((tag) => tag.name).join(', ')}
            </span>
          )}
          {/* The next review date, or none (features/12_review_interval_setting question 14). */}
          <span data-testid="note-review" className="min-w-0 text-slate-600 wrap-anywhere">
            {note.next_review_date ? `Next review: ${formatReviewDate(note.next_review_date)}` : 'No review scheduled'}
          </span>
          {/* The review state, from the server alone (features/15_review_due_today question 3). */}
          <ReviewStateLabel state={note.review_state} />
          {note.status === 'archived' && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">Archived</span>
          )}
        </li>
      ))}
    </ul>
  )
}

type NotesProps = {
  // A notes request answered 401: the app shows the sign-in screen.
  onSignedOut: () => void
  // The collections renamed in the collections area, by id: their notes show the new
  // names, with no notes request (features/09_notes_crud).
  renamedCollections: Record<number, string>
  // The tags renamed (a name) or deleted (null) in the tags area, by id (features/10_note_tags).
  changedTags: Record<number, string | null>
  // The left area's collections and tags, or null while a list loads or cannot load: the
  // choices of the filters "Collection" and "Tag" (features/17_search_and_filter question 16).
  collections: NamedRecord[] | null
  tags: NamedRecord[] | null
  // The handle App uses for "Open" in the review reminders panel (features/20_realtime_notifications).
  ref?: Ref<NotesHandle>
  // Whether the new-note or the edit form shows: "Open" in the review reminders panel waits
  // while it does, so a form is closed only by its own buttons
  // (features/20_realtime_notifications question 9).
  onFormOpenChange?: (open: boolean) => void
}

// The notes area of the main layout (features/09_notes_crud): the list of the user's
// notes, or one note's detail in its place.
function Notes({ onSignedOut, renamedCollections, changedTags, collections, tags, ref, onFormOpenChange }: NotesProps) {
  const [view, setView] = useState<View>({ kind: 'list' })
  // A message above the list, such as a note that no longer exists.
  const [notice, setNotice] = useState<string | null>(null)
  // The text in "Search", as typed (features/17_search_and_filter question 5).
  const [searchText, setSearchText] = useState('')
  // The search the list asks for: the field's text, tidied, once the field has paused.
  const [search, setSearch] = useState('')
  // The choices of "Collection", "Tag", "Status", and "Review", each "" for "All" at first
  // (features/15_review_due_today question 4; features/17_search_and_filter question 1).
  const [choices, setChoices] = useState<FilterChoices>(ALL_CHOICES)
  // How many loads were asked for: each choice, each new search, and each "Try again" asks
  // for one.
  const [loads, setLoads] = useState(0)
  // The latest answer, kept with the load it answers.
  const [loaded, setLoaded] = useState<LoadedList | null>(null)
  const headingId = useId()
  // The choices as they count: a chosen collection or tag that the left area no longer lists
  // (it was deleted) is "All", so the bar shows "All" and the list loads again without it
  // (features/17_search_and_filter question 10). Derived at render, with no effect.
  const shownChoices: FilterChoices = {
    ...choices,
    collectionId: listed(collections, choices.collectionId) ? choices.collectionId : '',
    tagId: listed(tags, choices.tagId) ? choices.tagId : '',
  }
  const address = notesAddress({ search, ...shownChoices })
  // A search, a collection, a tag, or a status narrows the list; "Review" alone has its own
  // empty text (features/17_search_and_filter question 11). These are what the shown answer
  // was asked with: the list shows only the answer to the current address.
  const narrowed =
    search !== '' || shownChoices.collectionId !== '' || shownChoices.tagId !== '' || shownChoices.status !== ''
  // The load the list shows: the address, and its number, so a choice that comes back to
  // an earlier address loads again. Until its answer arrives, the list shows "Loading…"
  // (features/15_review_due_today question 7).
  const load = `${loads} ${address}`
  const list = loaded?.load === load ? loaded.list : LOADING

  // The list loads when the area shows, after each choice and each search, when a chosen
  // collection or tag is deleted, and on "Try again", which asks again with the same search
  // and filters. Only the answer to the latest load shows: the cleanup drops an answer that
  // arrives after another load was asked for.
  useEffect(() => {
    let latest = true
    fetchNotes(address).then((answer) => {
      if (latest) setLoaded({ load, list: answer })
    })
    return () => {
      latest = false
    }
  }, [address, load])

  // The search runs 300 ms after the last change of the field, with the text tidied as the
  // server tidies it; a change that leaves the tidied text as it was asks for nothing
  // (features/17_search_and_filter questions 5 and 13). The state is set in the timer.
  useEffect(() => {
    const tidied = tidySearch(searchText)
    if (tidied === search) return
    const timer = setTimeout(() => {
      setSearch(tidied)
      setLoads((count) => count + 1)
    }, SEARCH_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [searchText, search])

  // A change made in this tab, such as a created, saved, or deleted note, applied to the
  // list as it was loaded. It stays until the list loads again (spec question 6).
  const changeList = useCallback((change: (current: ListState) => ListState) => {
    setLoaded((current) => current && { ...current, list: change(current.list) })
  }, [])

  // The list with each renamed collection's new name on its notes, shown at render time
  // rather than copied into state, so a rename needs no notes request.
  const shownList = withTagChanges(withRenames(list, renamedCollections), changedTags)

  useEffect(() => {
    if (list.status === 'signed-out') onSignedOut()
  }, [list.status, onSignedOut])

  const formOpen = view.kind === 'create' || view.kind === 'edit'
  useEffect(() => {
    onFormOpenChange?.(formOpen)
  }, [formOpen, onFormOpenChange])

  const retryList = () => setLoads((count) => count + 1)

  // A choice in one of the drop-down lists: the list loads for it at once, with no pause
  // (features/17_search_and_filter edge case).
  const choose = (change: Partial<FilterChoices>) => {
    setChoices((current) => ({ ...current, ...change }))
    setLoads((count) => count + 1)
  }

  // "Clear search and filters": the field empty, every drop-down list at "All", and the list
  // loaded at once for every note (features/17_search_and_filter question 11).
  const clearAll = () => {
    setSearchText('')
    setSearch('')
    setChoices(ALL_CHOICES)
    setLoads((count) => count + 1)
  }

  // Shows another view. An old message goes with the view it was shown in.
  const openView = (next: View) => {
    setView(next)
    setNotice(null)
  }

  // "Open" in the review reminders panel shows the note's detail in place of the list or a
  // detail. Each opening has its own number in the detail's key, so "Open" on the note whose
  // detail shows loads it again and puts the focus on its title (features/20_realtime_notifications).
  const openings = useRef(0)
  useImperativeHandle(ref, () => ({
    openNote: (id: number) => {
      openings.current += 1
      openView({ kind: 'detail', id, opened: openings.current })
    },
  }))

  // A created note is the newest, so it goes at the top of the list, and its detail
  // shows (spec question 1).
  const noteCreated = (note: Note) => {
    changeList((current) => (current.status === 'ready' ? { status: 'ready', notes: [note, ...current.notes] } : current))
    openView({ kind: 'detail', id: note.id, note })
  }

  // A saved note keeps its place in the list, with its new values, and its detail shows
  // them (spec questions 1 and 2).
  const noteSaved = (note: Note) => {
    changeList((current) => withNote(current, note))
    openView({ kind: 'detail', id: note.id, note })
  }

  // The note is off the list: the list shows again without it. A note that was
  // deleted elsewhere says so; a note this tab deleted (204) leaves with no alert
  // (features/06_collections_crud question 12; features/09_notes_crud question 12).
  const noteGone = useCallback(
    (id: number, message: string | null = 'This note no longer exists.') => {
      changeList((current) => withoutNote(current, id))
      setView({ kind: 'list' })
      setNotice(message)
    },
    [changeList],
  )

  // A note this tab deleted: it leaves the list with no alert.
  const noteDeleted = useCallback((id: number) => noteGone(id, null), [noteGone])

  return (
    <main aria-labelledby={headingId} className="flex-1 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id={headingId} className="font-semibold">
          Notes
        </h2>
        {view.kind === 'list' && list.status === 'ready' && (
          <button
            type="button"
            onClick={() => openView({ kind: 'create' })}
            className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            New note
          </button>
        )}
      </div>
      {/* The filters show with the list, in each of its states, and not with a note or a form
          (features/15_review_due_today question 8). */}
      {view.kind === 'list' && (
        <NoteFilters
          searchText={searchText}
          onSearchTextChange={setSearchText}
          collections={collections}
          tags={tags}
          choices={shownChoices}
          onChoose={choose}
        />
      )}
      {notice && (
        <p role="alert" className="mb-2 rounded bg-red-50 px-2 py-1 text-sm text-red-700">
          {notice}
        </p>
      )}
      {view.kind === 'list' && (
        <NoteList
          list={shownList}
          emptyText={narrowed ? NO_MATCH_TEXT : EMPTY_TEXT[shownChoices.review]}
          clearable={narrowed}
          onClear={clearAll}
          onOpen={(id) => openView({ kind: 'detail', id })}
          onRetry={retryList}
        />
      )}
      {view.kind === 'create' && (
        <NoteForm
          onSaved={noteCreated}
          onCancel={() => openView({ kind: 'list' })}
          onSignedOut={onSignedOut}
        />
      )}
      {view.kind === 'detail' && (
        <NoteDetail
          key={`${view.id}:${view.opened ?? 0}`}
          id={view.id}
          note={view.note}
          onBack={() => openView({ kind: 'list' })}
          onEdit={(note) => openView({ kind: 'edit', note })}
          onChanged={(note) => changeList((current) => withNote(current, note))}
          onGone={noteGone}
          onDeleted={noteDeleted}
          onSignedOut={onSignedOut}
          renamedCollections={renamedCollections}
          changedTags={changedTags}
        />
      )}
      {view.kind === 'edit' && (
        <NoteForm
          note={view.note}
          onSaved={noteSaved}
          onCancel={() => openView({ kind: 'detail', id: view.note.id, note: view.note })}
          onGone={() => noteGone(view.note.id)}
          onSignedOut={onSignedOut}
        />
      )}
    </main>
  )
}

export default Notes

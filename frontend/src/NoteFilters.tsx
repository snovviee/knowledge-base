import { useId } from 'react'
import type { NamedRecord } from './NameListArea'
import type { FilterChoices, ReviewFilter, StatusFilter } from './notesAddress'
import { useNarrowScreen } from './useNarrowScreen'

type NoteFiltersProps = {
  // The text in "Search", as typed, and its changes: the notes area keeps it and runs the
  // search once the field pauses (features/17_search_and_filter question 5).
  searchText: string
  onSearchTextChange: (text: string) => void
  // The left area's collections and tags, in its order, or null while a list loads or cannot
  // load: "Collection" and "Tag" offer them after "All" (features/17_search_and_filter question 16).
  collections: NamedRecord[] | null
  tags: NamedRecord[] | null
  // The choices of the drop-down lists, "" for "All", and a choice made: the notes area keeps
  // them and loads the list for them.
  choices: FilterChoices
  onChoose: (change: Partial<FilterChoices>) => void
}

// A choice of a drop-down list, after "All".
type Option = { value: string; label: string }

// "Status" (features/17_search_and_filter question 1).
const STATUS_OPTIONS: Option[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

// "Review": due today (features/15_review_due_today), overdue (features/16_review_overdue),
// and the next 7 days and no review scheduled (features/17_search_and_filter questions 7, 8).
const REVIEW_OPTIONS: Option[] = [
  { value: 'due_today', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'next_7_days', label: 'Next 7 days' },
  { value: 'unscheduled', label: 'No review scheduled' },
]

// The left area's records as choices, in its order; none while its list is not loaded.
const recordOptions = (records: NamedRecord[] | null): Option[] =>
  (records ?? []).map((record) => ({ value: String(record.id), label: record.name }))

// The longest search the field takes: typing stops there, and a longer paste is cut, so the
// browser never sends a search the server refuses (features/17_search_and_filter question 17).
const SEARCH_MAX_LENGTH = 2000

// The look of each control in the bar, with the hover of every field (features/24_ui_states
// question 3).
const CONTROL =
  'rounded border border-slate-300 bg-white px-2 py-1 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300'
// The look of each label in the bar: the field labels' look of every form
// (features/24_ui_states question 4).
const LABEL = 'text-xs font-medium text-slate-600'

type FilterSelectProps = {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}

// A drop-down list of the bar, labelled with its name, with "All" (the value "") first. The
// label and the list stay together, and a list with a long choice is cut to the window's width
// (features/25_responsive_layout question 8).
function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  const id = useId()
  return (
    <div className="flex max-w-full shrink-0 items-center gap-2">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={`${CONTROL} min-w-0`}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// The bar above the notes list (features/15_review_due_today question 8;
// features/17_search_and_filter questions 1 and 15): the field "Search", empty at first, then
// the drop-down lists "Collection", "Tag", "Status", and "Review", each with "All" chosen at
// first. The notes area shows it only with the list, and keeps its text and its choices.
function NoteFilters({ searchText, onSearchTextChange, collections, tags, choices, onChoose }: NoteFiltersProps) {
  const searchId = useId()
  const narrow = useNarrowScreen()
  return (
    // The bar wraps when its controls do not fit on one line. On a narrow screen "Search" takes
    // a line of its own, and the lists follow below it (features/25_responsive_layout question 8).
    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
      <div className={narrow ? 'flex basis-full items-center gap-2' : 'flex items-center gap-2'}>
        <label htmlFor={searchId} className={LABEL}>
          Search
        </label>
        <input
          id={searchId}
          type="search"
          maxLength={SEARCH_MAX_LENGTH}
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          className={narrow ? `${CONTROL} w-full min-w-0` : CONTROL}
        />
      </div>
      <FilterSelect
        label="Collection"
        value={choices.collectionId}
        options={recordOptions(collections)}
        onChange={(collectionId) => onChoose({ collectionId })}
      />
      <FilterSelect
        label="Tag"
        value={choices.tagId}
        options={recordOptions(tags)}
        onChange={(tagId) => onChoose({ tagId })}
      />
      <FilterSelect
        label="Status"
        value={choices.status}
        options={STATUS_OPTIONS}
        onChange={(status) => onChoose({ status: status as StatusFilter })}
      />
      <FilterSelect
        label="Review"
        value={choices.review}
        options={REVIEW_OPTIONS}
        onChange={(review) => onChoose({ review: review as ReviewFilter })}
      />
    </div>
  )
}

export default NoteFilters

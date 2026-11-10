import NameListArea, { type NameListTexts, type NamedRecord } from './NameListArea'

// The words of the tags area (features/08_tags_crud).
const TEXTS: NameListTexts = {
  heading: 'Tags',
  newLabel: 'New tag',
  fieldLabel: 'Tag name',
  empty: 'No tags yet',
  loadFailed: 'Could not load tags. Try again.',
  taken: 'A tag with this name already exists.',
  createFailed: 'Could not create the tag. Try again.',
  renameFailed: 'Could not rename the tag. Try again.',
  deleteFailed: 'Could not delete the tag. Try again.',
  gone: 'This tag no longer exists.',
  // A tag's notes keep their other tags and their text (features/10_note_tags).
  deleteNote: 'Notes with this tag are kept.',
}

type TagsProps = {
  // A tags request answered 401: the app shows the sign-in screen.
  onSignedOut: () => void
  // A tag was renamed or deleted: the notes that carry it show the change (features/10_note_tags).
  onRenamed: (tag: NamedRecord) => void
  onDeleted: (id: number) => void
  // The tags the area lists, or null while they load or cannot load
  // (features/17_search_and_filter question 16).
  onRecords?: (tags: NamedRecord[] | null) => void
  // A closed panel of a narrow screen's bar (features/25_responsive_layout).
  hidden?: boolean
}

// The tags area of the main layout, below the collections area (features/08_tags_crud
// question 1). The list comes from GET /api/tags, in the server's order: alphabetical,
// ignoring case.
function Tags({ onSignedOut, onRenamed, onDeleted, onRecords, hidden }: TagsProps) {
  return (
    <NameListArea
      path="/api/tags"
      listKey="tags"
      recordKey="tag"
      texts={TEXTS}
      nameTestId="tag-name"
      className="border-t border-slate-200 p-4"
      onSignedOut={onSignedOut}
      onRenamed={onRenamed}
      onDeleted={onDeleted}
      onRecords={onRecords}
      hidden={hidden}
    />
  )
}

export default Tags

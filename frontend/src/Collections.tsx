import NameListArea, { type NameListTexts, type NamedRecord } from './NameListArea'

// The words of the collections area (features/06_collections_crud).
const TEXTS: NameListTexts = {
  heading: 'Collections',
  newLabel: 'New collection',
  fieldLabel: 'Collection name',
  empty: 'No collections yet',
  loadFailed: 'Could not load collections. Try again.',
  taken: 'A collection with this name already exists.',
  createFailed: 'Could not create the collection. Try again.',
  renameFailed: 'Could not rename the collection. Try again.',
  deleteFailed: 'Could not delete the collection. Try again.',
  deleteRefused: 'This collection still has notes. Move or delete them first.',
  gone: 'This collection no longer exists.',
}

type CollectionsProps = {
  // A collections request answered 401: the app shows the sign-in screen.
  onSignedOut: () => void
  // A collection was renamed: the notes that show its name take the new one.
  onRenamed: (collection: NamedRecord) => void
  // The collections the area lists, or null while they load or cannot load
  // (features/17_search_and_filter question 16).
  onRecords?: (collections: NamedRecord[] | null) => void
  // A closed panel of a narrow screen's bar (features/25_responsive_layout).
  hidden?: boolean
}

// The collections area of the main layout (features/06_collections_crud). The list
// comes from GET /api/collections, in the server's order: alphabetical, ignoring case.
function Collections({ onSignedOut, onRenamed, onRecords, hidden }: CollectionsProps) {
  return (
    <NameListArea
      path="/api/collections"
      listKey="collections"
      recordKey="collection"
      texts={TEXTS}
      nameTestId="collection-name"
      className="p-4"
      onSignedOut={onSignedOut}
      onRenamed={onRenamed}
      onRecords={onRecords}
      hidden={hidden}
    />
  )
}

export default Collections

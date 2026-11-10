import { useEffect, useId, useState } from 'react'
import { sendWithCsrfToken } from './api'

// A record that an area of the main layout lists, creates, renames, and deletes by its
// name: a collection (features/06_collections_crud) or a tag (features/08_tags_crud).
export type NamedRecord = { id: number; name: string }

// The words of an area. The rules and the states are the same in every area: tags
// reuse the answers that feature 06 gave for collections (features/08_tags_crud).
export type NameListTexts = {
  // The heading, which also names the area, such as "Collections".
  heading: string
  // The button that opens the create form, such as "New collection".
  newLabel: string
  // The label of the name field, such as "Collection name".
  fieldLabel: string
  // The empty state, such as "No collections yet".
  empty: string
  // The list could not load.
  loadFailed: string
  // A 422 with the code taken.
  taken: string
  // A create, rename, or delete that got no answer, or an error answer.
  createFailed: string
  renameFailed: string
  deleteFailed: string
  // A delete answered 409: the record cannot be deleted yet, because it still holds
  // something (features/07_collection_delete_rule). Optional: an area whose records
  // cannot be refused shows deleteFailed for every error answer.
  deleteRefused?: string
  // A line under the delete question, for an area whose delete keeps other records, such
  // as "Notes with this tag are kept." (features/10_note_tags).
  deleteNote?: string
  // A rename answered 404: the record was deleted elsewhere.
  gone: string
}

type ListState =
  | { status: 'loading' }
  // No answer, or an error answer: the list could not load.
  | { status: 'error' }
  | { status: 'ready'; records: NamedRecord[] }
  // A 401: the sign-in has ended, so the app shows the sign-in screen
  // (features/06_collections_crud question 13).
  | { status: 'signed-out' }

// The form or confirmation that is open. One at a time in each area
// (features/06_collections_crud question 9). Each area has its own
// (features/08_tags_crud question 2).
type Editor =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'rename'; id: number }
  | { kind: 'delete'; id: number }

// Asks for the area's list, on mount and on "Try again".
async function fetchList(path: string, listKey: string): Promise<ListState> {
  try {
    const res = await fetch(path)
    if (res.status === 401) return { status: 'signed-out' }
    if (!res.ok) return { status: 'error' }
    const body = (await res.json()) as Record<string, NamedRecord[]>
    return { status: 'ready', records: body[listKey] }
  } catch {
    return { status: 'error' }
  }
}

// The server's order: the name in NFC, case-folded, then the id. Lowercasing is the
// browser's nearest match for the server's case folding.
const sortKey = (name: string) => name.normalize('NFC').toLowerCase()

function byName(a: NamedRecord, b: NamedRecord) {
  const [keyA, keyB] = [sortKey(a.name), sortKey(b.name)]
  if (keyA !== keyB) return keyA < keyB ? -1 : 1
  return a.id - b.id
}

// The server checks every name rule. Its 422 answer names one code per field
// (features/06_collections_crud questions 1 and 11). The message for taken is the
// area's own.
const NAME_MESSAGES: Record<string, string> = {
  blank: 'Enter a name.',
  too_long: 'Use at most 100 characters.',
}

// The message under the name field: a refused name marks the field invalid.
type FormMessage = { text: string; invalid: boolean }

type NameFormProps = {
  fieldLabel: string
  initialName?: string
  submitLabel: string
  message: FormMessage | null
  // The request is waiting: the submit button is busy and takes no second click.
  busy: boolean
  onSubmit: (name: string) => void
  onCancel: () => void
}

// The create and rename form: the name field with the focus, a submit button,
// "Cancel", and the message under the field. Escape cancels.
function NameForm({ fieldLabel, initialName = '', submitLabel, message, busy, onSubmit, onCancel }: NameFormProps) {
  const [name, setName] = useState(initialName)
  const fieldId = useId()
  const messageId = useId()

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(name)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
      className="mb-3 flex flex-col gap-2"
    >
      <label htmlFor={fieldId} className="text-xs font-medium text-slate-600">
        {fieldLabel}
      </label>
      <input
        id={fieldId}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoFocus
        aria-invalid={message?.invalid || undefined}
        aria-describedby={message ? messageId : undefined}
        className="rounded border border-slate-300 px-2 py-1 text-sm hover:border-slate-400 hover:bg-slate-50 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 aria-invalid:border-red-600"
      />
      {message && (
        <p id={messageId} role="alert" className="text-xs text-red-700">
          {message.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

type DeleteConfirmationProps = {
  name: string
  // A line under the question, when the area has one to give.
  note?: string
  // The failure message of the last try, if it failed.
  message: string | null
  // The request is waiting: "Delete" is busy and takes no second click.
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

// In place of a row: the question, "Delete", and "Cancel" with the focus, because a
// delete cannot be undone (features/06_collections_crud question 10). Escape cancels.
function DeleteConfirmation({ name, note, message, busy, onConfirm, onCancel }: DeleteConfirmationProps) {
  const questionId = useId()

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
      className="mb-1 flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-2"
    >
      <p id={questionId} className="text-sm text-slate-900 wrap-anywhere">
        Delete “{name}”? This cannot be undone.
      </p>
      {note && <p className="text-xs text-slate-600">{note}</p>}
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className="rounded bg-red-700 px-3 py-1 text-sm text-white hover:bg-red-800 disabled:opacity-60"
        >
          Delete
        </button>
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

type NameListAreaProps = {
  // The list's API path, such as '/api/collections'. A record's path adds its id.
  path: string
  // The keys of the API's answers: { "<listKey>": [...] } for the list, and
  // { "<recordKey>": { ... } } for a created or renamed record.
  listKey: string
  recordKey: string
  texts: NameListTexts
  // The test id of each name in the list, such as 'collection-name'.
  nameTestId: string
  // The classes of the area itself.
  className: string
  // A request answered 401: the app shows the sign-in screen.
  onSignedOut: () => void
  // A record was renamed: other areas that show its name (the notes, for a collection)
  // take the new name (features/09_notes_crud, the rename that shows on the notes).
  onRenamed?: (record: NamedRecord) => void
  // A record was deleted: other areas that show its name drop it (features/10_note_tags).
  onDeleted?: (id: number) => void
  // The records the area lists, each time its list changes: once loaded, and after a
  // create, a rename, or a delete; null while it loads or cannot load. The notes filters
  // offer them (features/17_search_and_filter questions 10 and 16).
  onRecords?: (records: NamedRecord[] | null) => void
  // The area is a closed panel of a narrow screen's bar: hidden, and still mounted, so it keeps
  // its list and its open form (features/25_responsive_layout question 4).
  hidden?: boolean
}

// An area of the main layout that lists the user's records in the server's order
// (alphabetical, ignoring case), and creates, renames, and deletes them in place
// (features/06_collections_crud, features/08_tags_crud).
function NameListArea({
  path,
  listKey,
  recordKey,
  texts,
  nameTestId,
  className,
  onSignedOut,
  onRenamed,
  onDeleted,
  onRecords,
  hidden,
}: NameListAreaProps) {
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [editor, setEditor] = useState<Editor>({ kind: 'none' })
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null)
  // A message for the whole area, such as a rename of a record that is gone.
  const [notice, setNotice] = useState<string | null>(null)
  // A create, rename, or delete is waiting for the server.
  const [busy, setBusy] = useState(false)
  const headingId = useId()

  useEffect(() => {
    fetchList(path, listKey).then(setList)
  }, [path, listKey])

  useEffect(() => {
    if (list.status === 'signed-out') onSignedOut()
  }, [list.status, onSignedOut])

  useEffect(() => {
    onRecords?.(list.status === 'ready' ? list.records : null)
  }, [list, onRecords])

  // Opens a form (or closes the open one with { kind: 'none' }). The form that was
  // open closes, and old messages go with it (features/06_collections_crud question 9).
  const openEditor = (next: Editor) => {
    setEditor(next)
    setFormMessage(null)
    setNotice(null)
  }

  const retryList = () => {
    setList({ status: 'loading' })
    fetchList(path, listKey).then(setList)
  }

  // Puts a created or renamed record in its place, in the server's order.
  const putInList = (record: NamedRecord) => {
    setList((current) =>
      current.status === 'ready'
        ? {
            status: 'ready',
            records: [...current.records.filter(({ id }) => id !== record.id), record].sort(byName),
          }
        : current,
    )
  }

  // Takes a record off the list, for example one that was deleted elsewhere.
  const removeFromList = (id: number) => {
    setList((current) =>
      current.status === 'ready'
        ? { status: 'ready', records: current.records.filter((record) => record.id !== id) }
        : current,
    )
  }

  // Sends a create or a rename and shows its answer: the saved record takes its place
  // in the list and the form closes; a 401 shows the sign-in screen; a 422 shows the
  // field's message; a 404 calls onNotFound; no answer, or any other error answer,
  // shows the failure message (features/06_collections_crud questions 12 and 13).
  const saveName = async (
    send: () => Promise<Response>,
    failureText: string,
    onNotFound?: () => void,
    isRename = false,
  ) => {
    const failed = { text: failureText, invalid: false }
    setBusy(true)
    try {
      const res = await send()
      if (res.status === 401) {
        setList({ status: 'signed-out' })
        return
      }
      if (res.status === 404 && onNotFound) {
        onNotFound()
        return
      }
      if (res.status === 422) {
        const refused = (await res.json()) as { fields: { name: string } }
        const code = refused.fields.name
        setFormMessage({ text: code === 'taken' ? texts.taken : NAME_MESSAGES[code], invalid: true })
        return
      }
      if (!res.ok) {
        setFormMessage(failed)
        return
      }
      const body = (await res.json()) as Record<string, NamedRecord>
      putInList(body[recordKey])
      // A rename (a save to an existing record) tells the other areas; a create does not.
      if (isRename) onRenamed?.(body[recordKey])
      setEditor({ kind: 'none' })
    } catch {
      setFormMessage(failed)
    } finally {
      setBusy(false)
    }
  }

  const createRecord = (name: string) =>
    saveName(() => sendWithCsrfToken('POST', path, { name }), texts.createFailed)

  const renameRecord = (id: number, name: string) =>
    saveName(
      () => sendWithCsrfToken('PATCH', `${path}/${id}`, { name }),
      texts.renameFailed,
      () => {
        // Deleted elsewhere, for example in another tab.
        removeFromList(id)
        setEditor({ kind: 'none' })
        setNotice(texts.gone)
      },
      true,
    )

  // A 404 means it was already deleted elsewhere: it leaves the list all the same,
  // with no error. A 401 shows the sign-in screen. A 409 is a refusal, shown with the
  // area's reason (features/07_collection_delete_rule). No answer, or any other error
  // answer, shows the failure message (features/06_collections_crud questions 12, 13).
  const deleteRecord = async (id: number) => {
    const failed = { text: texts.deleteFailed, invalid: false }
    setBusy(true)
    try {
      const res = await sendWithCsrfToken('DELETE', `${path}/${id}`)
      if (res.status === 401) {
        setList({ status: 'signed-out' })
      } else if (res.ok || res.status === 404) {
        removeFromList(id)
        onDeleted?.(id)
        setEditor({ kind: 'none' })
      } else if (res.status === 409 && texts.deleteRefused) {
        setFormMessage({ text: texts.deleteRefused, invalid: false })
      } else {
        setFormMessage(failed)
      }
    } catch {
      setFormMessage(failed)
    } finally {
      setBusy(false)
    }
  }

  // A row of the list: its rename form, its delete confirmation, or the name with
  // "Rename" and "Delete".
  const renderRow = (record: NamedRecord) => {
    if (editor.kind === 'rename' && editor.id === record.id) {
      return (
        <NameForm
          fieldLabel={texts.fieldLabel}
          initialName={record.name}
          submitLabel="Save"
          message={formMessage}
          busy={busy}
          onSubmit={(name) => renameRecord(record.id, name)}
          onCancel={() => openEditor({ kind: 'none' })}
        />
      )
    }

    if (editor.kind === 'delete' && editor.id === record.id) {
      return (
        <DeleteConfirmation
          name={record.name}
          note={texts.deleteNote}
          message={formMessage?.text ?? null}
          busy={busy}
          onConfirm={() => deleteRecord(record.id)}
          onCancel={() => openEditor({ kind: 'none' })}
        />
      )
    }

    return (
      <div className="flex items-start gap-1">
        <span data-testid={nameTestId} className="min-w-0 flex-1 py-1 wrap-anywhere">
          {record.name}
        </span>
        <button
          type="button"
          aria-label={`Rename ${record.name}`}
          onClick={() => openEditor({ kind: 'rename', id: record.id })}
          className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          Rename
        </button>
        <button
          type="button"
          aria-label={`Delete ${record.name}`}
          onClick={() => openEditor({ kind: 'delete', id: record.id })}
          className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          Delete
        </button>
      </div>
    )
  }

  return (
    <aside aria-labelledby={headingId} className={className} hidden={hidden}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id={headingId} className="font-semibold">
          {texts.heading}
        </h2>
        {list.status === 'ready' && (
          <button
            type="button"
            onClick={() => openEditor({ kind: 'create' })}
            className="rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {texts.newLabel}
          </button>
        )}
      </div>
      {notice && (
        <p role="alert" className="mb-2 rounded bg-red-50 px-2 py-1 text-sm text-red-700">
          {notice}
        </p>
      )}
      {editor.kind === 'create' && (
        <NameForm
          fieldLabel={texts.fieldLabel}
          submitLabel="Create"
          message={formMessage}
          busy={busy}
          onSubmit={createRecord}
          onCancel={() => openEditor({ kind: 'none' })}
        />
      )}
      {list.status === 'loading' && (
        <p role="status" className="text-sm text-slate-600">
          Loading…
        </p>
      )}
      {list.status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-red-700">
            {texts.loadFailed}
          </p>
          <button
            type="button"
            onClick={retryList}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      )}
      {list.status === 'ready' && list.records.length === 0 && <p className="text-sm text-slate-600">{texts.empty}</p>}
      {list.status === 'ready' && list.records.length > 0 && (
        <ul className="flex flex-col gap-1">
          {list.records.map((record) => (
            <li key={record.id} className="text-sm">
              {renderRow(record)}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

export default NameListArea

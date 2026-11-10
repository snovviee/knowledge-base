import { type RefObject, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { NamedRecord } from './NameListArea'

// The tags group of the note form (features/10_note_tags). It loads the user's tags on
// its own, so the rest of the form works while they load (spec question 7).
type TagsState =
  | { status: 'loading' }
  // No answer, or an error answer: the tags could not load.
  | { status: 'error' }
  | { status: 'ready'; tags: NamedRecord[] }
  // A 401: the sign-in has ended, so the app shows the sign-in screen.
  | { status: 'signed-out' }

// Asks for the user's tags, in the server's order: alphabetical, ignoring case.
async function fetchTags(): Promise<TagsState> {
  try {
    const res = await fetch('/api/tags')
    if (res.status === 401) return { status: 'signed-out' }
    if (!res.ok) return { status: 'error' }
    const body = (await res.json()) as { tags: NamedRecord[] }
    return { status: 'ready', tags: body.tags }
  } catch {
    return { status: 'error' }
  }
}

type NoteTagsProps = {
  // The ids checked when the group opens: the note's tags in the edit form, none in the
  // new-note form.
  initialChecked: number[]
  // The checked ids, as the user changes them.
  onChange: (checked: number[]) => void
  // A request answered 401: the app shows the sign-in screen.
  onSignedOut: () => void
  // The form calls refuse() on this ref when a chosen tag no longer exists (spec question 9).
  refusalRef: RefObject<{ refuse: () => void } | null>
}

// The "Tags" group: one checkbox per tag. A group that cannot load says so, and "Try
// again" loads it again. Its states are "Loading…", the failure, and "No tags yet".
function NoteTags({ initialChecked, onChange, onSignedOut, refusalRef }: NoteTagsProps) {
  const [tags, setTags] = useState<TagsState>({ status: 'loading' })
  const [checked, setChecked] = useState<number[]>(initialChecked)
  const [refusal, setRefusal] = useState(false)
  const headingId = useId()
  const groupRef = useRef<HTMLFieldSetElement>(null)

  // Shows the answer: a 401 hands over to the sign-in screen instead.
  const show = useCallback(
    (answer: TagsState) => {
      if (answer.status === 'signed-out') onSignedOut()
      else setTags(answer)
    },
    [onSignedOut],
  )

  useEffect(() => {
    fetchTags().then(show)
  }, [show])

  // A chosen tag that no longer exists: show the message, load the tags again, and keep
  // the checks of the tags that still exist. The focus moves to the group. The form calls
  // this when its answer comes (spec question 9), so it is an event, not an effect.
  const refuse = useCallback(() => {
    setRefusal(true)
    setTags({ status: 'loading' })
    fetchTags().then((answer) => {
      show(answer)
      if (answer.status === 'ready') {
        const still = new Set(answer.tags.map((tag) => tag.id))
        const kept = checked.filter((id) => still.has(id))
        setChecked(kept)
        onChange(kept)
      }
      groupRef.current?.focus()
    })
    // The handle is rebuilt when the checked set or the handler changes, so refuse() sees
    // the current checks.
  }, [show, checked, onChange])

  useImperativeHandle(refusalRef, () => ({ refuse }), [refuse])

  const toggle = (id: number, on: boolean) => {
    const next = on ? [...checked.filter((x) => x !== id), id] : checked.filter((x) => x !== id)
    setChecked(next)
    onChange(next)
  }

  return (
    <fieldset ref={groupRef} tabIndex={-1} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-1 focus:outline-none">
      <legend id={headingId} className="text-xs font-medium text-slate-600">
        Tags
      </legend>
      {tags.status === 'loading' && (
        <p role="status" className="text-sm text-slate-600">
          Loading…
        </p>
      )}
      {tags.status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-red-700">
            Could not load tags. Try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setTags({ status: 'loading' })
              fetchTags().then(show)
            }}
            className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      )}
      {tags.status === 'ready' && tags.tags.length === 0 && <p className="text-sm text-slate-600">No tags yet</p>}
      {tags.status === 'ready' &&
        tags.tags.map((tag) => (
          // A native checkbox draws its own box, so its hover shows on its row
          // (features/24_ui_states question 3).
          <label key={tag.id} className="flex items-center gap-2 rounded text-sm wrap-anywhere hover:bg-slate-100">
            <input
              type="checkbox"
              checked={checked.includes(tag.id)}
              onChange={(event) => toggle(tag.id, event.target.checked)}
            />
            {tag.name}
          </label>
        ))}
      {refusal && (
        <p role="alert" className="text-xs text-red-700">
          A chosen tag no longer exists. Check the tags again.
        </p>
      )}
    </fieldset>
  )
}


export default NoteTags

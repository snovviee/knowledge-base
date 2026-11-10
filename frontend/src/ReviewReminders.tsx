import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { openCable, type Cable } from './cable'
import ReviewStateLabel from './ReviewStateLabel'
import { formatReviewDate } from './reviewSchedule'

// A review reminder of a batch (features/20_realtime_notifications question 2).
type Reminder = {
  type: 'review_due_today' | 'review_overdue'
  note_id: number
  title: string
  collection_name: string
  // "YYYY-MM-DD"
  next_review_date: string
  review_state: 'due_today' | 'overdue'
}

// A message of the reminders subscription. The panel reads only a batch:
// { "type": "review_reminders", "reminders": [ ... ] } (spec question 3).
type SubscriptionMessage = { type?: string; reminders?: Reminder[] }

// A reminder is the same when its note, its type, and its date are (spec question 7). A
// reminder whose type changes at midnight is a new one.
const reminderKey = (reminder: Reminder) => `${reminder.note_id}:${reminder.type}:${reminder.next_review_date}`

interface Props {
  // The server refused the connection or ended it: the sign-in screen shows, as for a 401.
  onSignedOut: () => void
  // "Open": the notes area shows the note's detail (spec question 6).
  onOpen: (noteId: number) => void
  // The notes area shows a note form: every "Open" waits (spec question 9).
  openDisabled: boolean
}

// The review reminders panel of the main layout (features/20_realtime_notifications), above
// the notes area. It owns the main layout's real-time connection (features/22_websocket_auth),
// which opens once when the main layout shows, and closes when the sign-in screen takes its
// place.
export default function ReviewReminders({ onSignedOut, onOpen, openDisabled }: Props) {
  // App passes a new callback on each render. The connection calls the latest one, so it
  // stays the same connection.
  const signedOut = useEffectEvent(onSignedOut)
  const headingId = useId()
  // The latest batch's reminders, or null until the first batch.
  const [reminders, setReminders] = useState<Reminder[] | null>(null)
  // The connection is lost, or could not be opened, and no batch has come since. The client
  // connects again on its own (spec question 8).
  const [offline, setOffline] = useState(false)
  // The connection, for "Dismiss", and the heading that takes the focus after it.
  const cableRef = useRef<Cable | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const cable = openCable({
      onSignedOut: () => signedOut(),
      // Each batch replaces the whole list, and ends the offline state (spec questions 7 and 8).
      // Another message, such as the error answer to an ack, changes nothing: a reminder whose
      // ack was not recorded shows again with the next batch (features/23_websocket_client_message
      // question 5).
      onMessage: (message) => {
        const batch = message as SubscriptionMessage | null
        if (batch?.type !== 'review_reminders' || !Array.isArray(batch.reminders)) return
        setReminders(batch.reminders)
        setOffline(false)
      },
      onLost: () => setOffline(true),
    })
    cableRef.current = cable
    return () => cable.close()
  }, [])

  // "Dismiss" (features/23_websocket_client_message questions 1 and 4): sends the ack, takes
  // the reminder out at once, without waiting for an answer, and moves the focus to the
  // heading. An ack that could not be sent, because the socket closed a moment before the
  // panel heard of it, keeps the reminder, and the offline state follows with the close
  // (question 5).
  const dismiss = (reminder: Reminder) => {
    const ack = { note_id: reminder.note_id, next_review_date: reminder.next_review_date }
    if (!cableRef.current?.perform('ack', ack)) return
    setReminders((current) => current && current.filter((other) => reminderKey(other) !== reminderKey(reminder)))
    headingRef.current?.focus()
  }

  return (
    <section aria-labelledby={headingId} className="border-b border-slate-200 px-4 py-3">
      {/* The focus can be moved to the heading (tabIndex -1). */}
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="font-semibold focus:outline-none">
        Review reminders
      </h2>
      {offline && (
        // Above the last list, or alone before the first batch (spec question 8).
        <p role="alert" className="text-sm text-red-700">
          Review reminders are offline. Reconnecting…
        </p>
      )}
      {reminders === null && !offline && (
        // No batch yet (spec question 8).
        <p role="status" className="text-sm text-slate-600">
          Loading…
        </p>
      )}
      {reminders?.length === 0 && <p className="text-sm text-slate-600">No review reminders</p>}
      {reminders !== null && reminders.length > 0 && (
        // A long list scrolls inside the panel, so the notes area stays in view (spec question 6).
        <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto">
          {reminders.map((reminder) => (
            // Keyed by note, type, and date: a reminder that a new batch repeats keeps its
            // element, and the focus, wherever the batch puts it (spec question 7).
            <li key={reminderKey(reminder)} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 font-medium wrap-anywhere">{reminder.title}</span>
              <span className="min-w-0 text-slate-600 wrap-anywhere">{reminder.collection_name}</span>
              <ReviewStateLabel state={reminder.review_state} />
              <span className="text-slate-600">Next review: {formatReviewDate(reminder.next_review_date)}</span>
              <button
                type="button"
                onClick={() => onOpen(reminder.note_id)}
                disabled={openDisabled}
                className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              >
                Open
              </button>
              {/* Offline, the ack could not be sent (features/23_websocket_client_message question 5). */}
              <button
                type="button"
                onClick={() => dismiss(reminder)}
                disabled={offline}
                className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

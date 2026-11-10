# The user's review reminders as one message, a batch (features/20_realtime_notifications
# questions 1 to 3): one reminder for each of the user's notes that is due today or overdue
# on the user's today (features/15_review_due_today, features/16_review_overdue), the oldest
# next review date first, then the oldest note first. It is the whole current list, with no
# limit, and it is made again for each batch: nothing about a batch is stored. A reminder the
# user dismissed with an ack is left out while the note keeps that date
# (features/23_websocket_client_message question 2). The values are ready for JSON (the date
# is text), so a broadcast and a channel's transmit send the same.
class ReviewReminderBatch
  def self.for(user)
    new(user).message
  end

  # The user's notes that a batch reminds of on the given day, the user's today: due today
  # or overdue. An ack must name one of them (features/23_websocket_client_message
  # question 3).
  def self.reminded_notes(user, today)
    user.notes.due_today(today).or(user.notes.overdue(today))
  end

  # Today is read once, so every note of the batch is judged on the same date.
  def initialize(user)
    @user = user
    @today = user.today
  end

  # { type: "review_reminders", reminders: [ ... ] }, with an empty list when nothing is due.
  def message
    { type: "review_reminders", reminders: due_notes.map { |note| reminder(note) } }
  end

  private

    attr_reader :user, :today

    # A reminder the user dismissed for the note's current next review date is left out
    # (features/23_websocket_client_message question 2). A dismissal for another date hides
    # nothing.
    def due_notes
      self.class.reminded_notes(user, today).where.not(dismissed_for_its_date)
        .includes(:collection).order(:next_review_date, :created_at, :id)
    end

    def dismissed_for_its_date
      ReviewDismissal.where(
        "review_dismissals.note_id = notes.id AND review_dismissals.next_review_date = notes.next_review_date"
      ).arel.exists
    end

    # The type is "review_" and the note's review state: "review_due_today" or
    # "review_overdue" (spec question 2).
    def reminder(note)
      state = note.review_state(today)
      {
        type: "review_#{state}",
        note_id: note.id,
        title: note.title,
        collection_name: note.collection.name,
        next_review_date: note.next_review_date.iso8601,
        review_state: state
      }
    end
end

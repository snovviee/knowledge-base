# An ack of a review reminder, sent by the client on the reminders subscription
# (features/23_websocket_client_message question 1):
# { "action": "ack", "note_id": 7, "next_review_date": "2026-11-09" }. The values are checked
# as Action Cable decoded them from the JSON, so 7.0 is not a whole number and "7" is text.
class ReviewAck
  def initialize(user, data)
    @user = user
    @note_id = data["note_id"]
    @next_review_date = data["next_review_date"]
  end

  # Records the ack. Returns nil when it is accepted, or else the error code to answer:
  # "invalid" for an ack that is not well-formed, and "not_found" for one that names no
  # current reminder of the user (question 3).
  def record
    return "invalid" unless well_formed?

    note = current_reminder
    return "not_found" unless note

    # The same ack again, from another tab at the same moment included, finds the row the
    # first one made, through the unique index, and is accepted too.
    ReviewDismissal.create_or_find_by!(user: user, note: note, next_review_date: note.next_review_date)
    nil
  end

  private

    attr_reader :user, :note_id, :next_review_date

    # note_id is a JSON whole number, and next_review_date a real date written YYYY-MM-DD,
    # the rule of a note's next review date (features/12_review_interval_setting question 2).
    def well_formed?
      note_id.is_a?(Integer) && next_review_date.is_a?(String) &&
        next_review_date.match?(/\A\d{4}-\d{2}-\d{2}\z/) &&
        Date.valid_date?(*next_review_date.split("-").map(&:to_i))
    end

    # The note of a reminder the server would send the user now, for this date: the user's,
    # Active, with a schedule, due today or overdue, and dated next_review_date. Another
    # user's note answers like a missing one (features/06_collections_crud question 3). A
    # reminder already dismissed still counts, so the same ack again is accepted.
    def current_reminder
      ReviewReminderBatch.reminded_notes(user, user.today).find_by(id: note_id, next_review_date: next_review_date)
    end
end

require "rails_helper"

# features/19_unscheduled_no_reminders. A note with the interval none has no review schedule:
# it is never due today or overdue, whatever its status or dates, so it has no review state,
# neither review scope holds it, and no batch reminds of it (spec question 1; requirements.md
# 3.5, 3.7, and 11). Only "No review scheduled" (Note.unscheduled) lists it. The rule lives in
# Note (features 15 and 16), and feature 20's batch builds on it. The time is fixed at
# 2026-11-09 20:00 UTC; a user with no saved zone has the today 2026-11-09 (UTC).
#
# The app never gives such a note a next review date (feature 12 drops it before every save),
# so some rows here get one straight in the database, with update_columns, which skips the
# model's rules: the interval, not a missing date, must keep them out.
RSpec.describe Note, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:today) { Date.new(2026, 11, 9) }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # A note of the user in "Work", with the given schedule and fields.
  def note_for(user, title, **fields)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: "Work"), title: title,
                       body: "Body of #{title}", **fields)
  end

  # A note of the user with the interval none whose row holds this next review date anyway.
  def stray(user, title, date, **fields)
    note_for(user, title, **fields).tap { |note| note.update_columns(next_review_date: date) }
  end

  it "AC-19 notes without a review schedule do not generate review reminders, whatever their status or dates" do
    note_for(ada, "Someday")
    note_for(ada, "Old someday", status: "archived")
    stray(ada, "Stray past", "2026-11-02")
    stray(ada, "Stray today", "2026-11-09")
    stray(ada, "Old stray", "2026-11-02", status: "archived")
    # The control: active weekly notes with the same dates.
    note_for(ada, "Weekly past", review_interval: "weekly", next_review_date: "2026-11-02")
    note_for(ada, "Weekly today", review_interval: "weekly", next_review_date: "2026-11-09")

    due_today = Note.due_today(today).ids
    overdue = Note.overdue(today).ids
    unscheduled = Note.unscheduled.ids
    reminded = ReviewReminderBatch.for(ada)[:reminders].pluck(:note_id)
    given = Note.order(:id).to_h do |note|
      [ note.title,
        [ note.review_interval, note.next_review_date&.iso8601, note.review_state(today), due_today.include?(note.id),
          overdue.include?(note.id), unscheduled.include?(note.id), reminded.include?(note.id) ] ]
    end

    expect(given).to eq(
      "Someday" => [ "none", nil, nil, false, false, true, false ],
      "Old someday" => [ "none", nil, nil, false, false, true, false ],
      "Stray past" => [ "none", "2026-11-02", nil, false, false, true, false ],
      "Stray today" => [ "none", "2026-11-09", nil, false, false, true, false ],
      "Old stray" => [ "none", "2026-11-02", nil, false, false, true, false ],
      "Weekly past" => [ "weekly", "2026-11-02", "overdue", false, true, false, true ],
      "Weekly today" => [ "weekly", "2026-11-09", "due_today", true, false, false, true ]
    )
  end
end

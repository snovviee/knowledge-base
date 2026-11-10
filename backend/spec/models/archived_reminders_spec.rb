require "rails_helper"

# features/18_archived_no_reminders. An archived note is never due today or overdue, whatever
# its interval and dates: it has no review state, neither review scope holds it, and no batch
# reminds of it (spec question 1; requirements.md 3.4, 3.5, 3.7, and 7). The rule lives in Note
# (features 15 and 16), and feature 20's batch builds on it. The time is fixed at 2026-11-09
# 20:00 UTC; a user with no saved zone has the today 2026-11-09 (UTC).
RSpec.describe Note, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:today) { Date.new(2026, 11, 9) }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # Every interval of a schedule (features/12_review_interval_setting), custom with 10 days.
  def schedules
    [ { review_interval: "daily" }, { review_interval: "weekly" }, { review_interval: "monthly" },
      { review_interval: "custom", review_interval_days: 10 } ]
  end

  # A next review date before today, today, and after today.
  def dates
    %w[2026-11-02 2026-11-09 2026-11-12]
  end

  # What an active note with this date gives, the control: its review state, whether
  # Note.due_today and Note.overdue hold it, and whether the batch reminds of it.
  def active_note_gives(date)
    { "2026-11-02" => [ "overdue", false, true, true ],
      "2026-11-09" => [ "due_today", true, false, true ],
      "2026-11-12" => [ nil, false, false, false ] }.fetch(date)
  end

  # A note of the user in "Work", with the given schedule and fields.
  def note_for(user, title, **fields)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: "Work"), title: title,
                       body: "Body of #{title}", **fields)
  end

  it "AC-18 archived notes do not generate review reminders, for every interval and every next review date" do
    expected = {}
    schedules.product(dates).each do |schedule, date|
      name = "#{schedule[:review_interval]} #{date}"
      note_for(ada, "Archived #{name}", status: "archived", next_review_date: date, **schedule)
      note_for(ada, "Active #{name}", next_review_date: date, **schedule)
      expected["Archived #{name}"] = [ nil, false, false, false ]
      expected["Active #{name}"] = active_note_gives(date)
    end

    due_today = Note.due_today(today).ids
    overdue = Note.overdue(today).ids
    reminded = ReviewReminderBatch.for(ada)[:reminders].pluck(:note_id)
    given = Note.order(:id).to_h do |note|
      [ note.title,
        [ note.review_state(today), due_today.include?(note.id), overdue.include?(note.id), reminded.include?(note.id) ] ]
    end

    expect(given).to eq(expected)
    expect(given.size).to eq(24)
    expect(reminded.size).to eq(8)
  end
end

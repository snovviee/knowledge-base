require "rails_helper"

# features/15_review_due_today. A note is due today when it is active, its interval is not
# none, and its next review date is the given today; overdue when that date is before today
# (requirements.md 3.5; spec question 1). Today is always passed in, so the clock never
# decides: the time is fixed at 2026-11-09 20:00 UTC, and a test may pass another date.
RSpec.describe Note, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:grace) { User.create!(provider: "github", provider_user_id: "42", display_name: "Grace") }
  let(:today) { Date.new(2026, 11, 9) }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # A note of the user, in their "Work" collection, with the given schedule and fields.
  def note_for(user, title, **fields)
    work = user.collections.find_or_create_by!(name: "Work")
    user.notes.create!(collection: work, title: title, body: "Body of #{title}", **fields)
  end

  # A weekly note of the user with the given next review date.
  def weekly(user, title, date, **fields)
    note_for(user, title, review_interval: "weekly", next_review_date: date, **fields)
  end

  it "AC-15 review_state is due_today for an active scheduled note dated today, overdue before today, and nil otherwise" do
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    late_tip = weekly(ada, "Late tip", "2026-11-08")
    a_year_late = weekly(ada, "A year late", "2025-11-09")
    tomorrow_tip = weekly(ada, "Tomorrow tip", "2026-11-10")
    archived_tip = weekly(ada, "Archived tip", "2026-11-09", status: "archived")
    archived_late = weekly(ada, "Archived late", "2026-11-02", status: "archived")
    someday = note_for(ada, "Someday")

    expect(rails_tips.review_state(today)).to eq("due_today")
    expect(late_tip.review_state(today)).to eq("overdue")
    expect(a_year_late.review_state(today)).to eq("overdue")
    expect(tomorrow_tip.review_state(today)).to be_nil
    expect(archived_tip.review_state(today)).to be_nil
    expect(archived_late.review_state(today)).to be_nil
    expect(someday.review_state(today)).to be_nil

    # The argument decides, not the clock: on 2026-11-10 the note dated that day is due.
    expect(tomorrow_tip.review_state(Date.new(2026, 11, 10))).to eq("due_today")
  end

  it "AC-15 due_today(today) finds exactly the notes whose review_state is due_today, and chains on a user's notes" do
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    weekly(ada, "Late tip", "2026-11-08")
    weekly(ada, "A year late", "2025-11-09")
    weekly(ada, "Tomorrow tip", "2026-11-10")
    weekly(ada, "Archived tip", "2026-11-09", status: "archived")
    weekly(ada, "Archived late", "2026-11-02", status: "archived")
    note_for(ada, "Someday")
    graces = weekly(grace, "Grace due", "2026-11-09")

    expect(Note.due_today(today)).to contain_exactly(rails_tips, graces)
    # The relation and review_state agree on every note.
    expect(Note.due_today(today)).to match_array(Note.all.select { |note| note.review_state(today) == "due_today" })
    expect(ada.notes.due_today(today)).to contain_exactly(rails_tips)
  end
end

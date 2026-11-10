require "rails_helper"

# features/16_review_overdue. A note is overdue when it is active, its interval is not none,
# and its next review date is before the given today, whatever its age (requirements.md 3.5;
# spec question 1). Overdue and due today (features/15_review_due_today) never share a note.
# The time is fixed at 2026-11-09 20:00 UTC; today is passed in.
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

  it "AC-16 overdue(today) finds the active scheduled notes dated before today, whatever their age, and never a note due today" do
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    yesterday = weekly(ada, "Yesterday", "2026-11-08")
    a_year_late = weekly(ada, "A year late", "2025-11-09")
    weekly(ada, "Rails tips", "2026-11-09")
    weekly(ada, "Tomorrow", "2026-11-10")
    weekly(ada, "Archived idea", "2026-11-02", status: "archived")
    note_for(ada, "Someday")
    graces = weekly(grace, "Grace late", "2026-11-06")

    expect(Note.overdue(today)).to contain_exactly(old_idea, yesterday, a_year_late, graces)
    # The relation and review_state agree on every note.
    expect(Note.overdue(today)).to match_array(Note.all.select { |note| note.review_state(today) == "overdue" })
    # Never at the same time as due today.
    expect(Note.overdue(today).ids & Note.due_today(today).ids).to be_empty
    expect(Note.due_today(today).ids).not_to be_empty
    expect(ada.notes.overdue(today)).to contain_exactly(old_idea, yesterday, a_year_late)
  end
end

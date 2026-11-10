require "rails_helper"

# features/20_realtime_notifications. A batch is the whole current list of the user's review
# reminders: one for each of their notes that is due today or overdue (features 15 and 16),
# the oldest next review date first, then by creation (spec questions 1 to 3). The time is
# fixed at 2026-11-09 20:00 UTC; a user with no saved zone has the today 2026-11-09 (UTC).
RSpec.describe ReviewReminderBatch, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # A note of the user in the named collection, with the given schedule and fields.
  def note_for(user, title, collection: "Work", **fields)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: collection), title: title,
                       body: "Body of #{title}", **fields)
  end

  # A weekly note of the user with the given next review date.
  def weekly(user, title, date, **fields)
    note_for(user, title, review_interval: "weekly", next_review_date: date, **fields)
  end

  it "AC-20 a batch lists the user's notes due today and overdue, the oldest next review date first and then by creation, each with the reminder fields" do
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    # "Ruby tips" is made first, so its id is lower, but it was created an hour after
    # "Rails tips": the order follows the creation, not the id.
    ruby_tips = weekly(ada, "Ruby tips", "2026-11-09", collection: "Books", created_at: 1.hour.from_now)
    rails_tips = weekly(ada, "Rails tips", "2026-11-09", collection: "Books")
    weekly(ada, "Later", "2026-11-12", collection: "Books")

    expect(described_class.for(ada)).to eq(
      type: "review_reminders",
      reminders: [
        { type: "review_overdue", note_id: old_idea.id, title: "Old idea", collection_name: "Work",
          next_review_date: "2026-11-02", review_state: "overdue" },
        { type: "review_due_today", note_id: rails_tips.id, title: "Rails tips", collection_name: "Books",
          next_review_date: "2026-11-09", review_state: "due_today" },
        { type: "review_due_today", note_id: ruby_tips.id, title: "Ruby tips", collection_name: "Books",
          next_review_date: "2026-11-09", review_state: "due_today" }
      ]
    )
  end

  it "AC-20 a batch leaves out archived notes, notes with the interval none, later notes, and other users' notes, and is empty when nothing is due" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    charles = User.create!(provider: "google_oauth2", provider_user_id: "u-3", display_name: "Charles")
    no_notes = User.create!(provider: "google_oauth2", provider_user_id: "u-4", display_name: "Dorothy")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    weekly(ada, "Old plan", "2026-11-02", status: "archived")
    weekly(ada, "Today's plan", "2026-11-09", status: "archived")
    note_for(ada, "Someday")
    weekly(ada, "Later", "2026-11-12")
    grace_due = weekly(grace, "Grace due", "2026-11-09")
    weekly(charles, "Charles later", "2026-11-12")

    expect(described_class.for(ada)[:reminders].pluck(:note_id)).to eq([ rails_tips.id ])
    expect(described_class.for(grace)[:reminders].pluck(:note_id)).to eq([ grace_due.id ])
    expect(described_class.for(charles)).to eq(type: "review_reminders", reminders: [])
    expect(described_class.for(no_notes)).to eq(type: "review_reminders", reminders: [])
  end

  it "AC-20 a batch holds every current reminder with no limit, and each note once" do
    60.times { |number| weekly(ada, "Overdue #{number}", "2026-11-02") }
    60.times { |number| weekly(ada, "Due #{number}", "2026-11-09") }

    note_ids = described_class.for(ada)[:reminders].pluck(:note_id)

    expect(note_ids.size).to eq(120)
    expect(note_ids.uniq.size).to eq(120)
    expect(note_ids).to match_array(ada.notes.ids)
  end
end

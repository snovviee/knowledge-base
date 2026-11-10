require "rails_helper"

# features/23_websocket_client_message. A dismissal lasts while its note keeps the next review
# date it was made for, and ends when that date changes, whatever saves the note (spec
# question 2 and edge cases). The time is fixed at 2026-11-09 20:00 UTC; a user with no saved
# zone has the today 2026-11-09 (UTC).
RSpec.describe ReviewDismissal, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # A new weekly "Rails tips" of Ada, due today, dismissed for its date as an ack does.
  def dismissed_rails_tips
    note = ada.notes.create!(collection: ada.collections.find_or_create_by!(name: "Books"), title: "Rails tips",
                             body: "Body of Rails tips", review_interval: "weekly", next_review_date: "2026-11-09")
    ReviewDismissal.create!(user: ada, note: note, next_review_date: note.next_review_date)
    note
  end

  # The dates the note's dismissals are for.
  def dismissed_dates(note)
    ReviewDismissal.where(note: note).pluck(:next_review_date)
  end

  it "AC-23 a dismissal ends when the note's next review date changes, even if the date later returns, and stays otherwise" do
    nov9 = Date.new(2026, 11, 9)

    # A review moves the date to today plus a week (features 13 and 14).
    reviewed = dismissed_rails_tips
    reviewed.mark_reviewed!
    expect(reviewed.next_review_date).to eq(Date.new(2026, 11, 16))
    expect(dismissed_dates(reviewed)).to eq([])

    # A new date, as the edit form sets it (feature 12 question 7).
    redated = dismissed_rails_tips
    redated.update!(next_review_date: "2026-11-05")
    expect(dismissed_dates(redated)).to eq([])

    # The interval None removes the date (feature 12 question 11).
    unscheduled = dismissed_rails_tips
    unscheduled.update!(review_interval: "none")
    expect(unscheduled.next_review_date).to be_nil
    expect(dismissed_dates(unscheduled)).to eq([])

    # A date that changes and comes back: the dismissal is over, and the reminder is back.
    returned = dismissed_rails_tips
    returned.update!(next_review_date: "2026-11-12")
    returned.update!(next_review_date: "2026-11-09")
    expect(dismissed_dates(returned)).to eq([])
    expect(ReviewReminderBatch.for(ada)[:reminders].pluck(:note_id)).to include(returned.id)

    # An archive and a restore change no date.
    archived = dismissed_rails_tips
    archived.update!(status: "archived")
    archived.update!(status: "active")
    expect(dismissed_dates(archived)).to eq([ nov9 ])

    # A new interval that keeps the date (feature 12 question 9).
    daily = dismissed_rails_tips
    daily.update!(review_interval: "daily")
    expect(daily.next_review_date).to eq(nov9)
    expect(dismissed_dates(daily)).to eq([ nov9 ])

    # A second review on the same day keeps the date of the first (feature 13 question 2).
    twice = dismissed_rails_tips
    twice.mark_reviewed!
    ReviewDismissal.create!(user: ada, note: twice, next_review_date: twice.next_review_date)
    twice.mark_reviewed!
    expect(dismissed_dates(twice)).to eq([ Date.new(2026, 11, 16) ])
  end
end

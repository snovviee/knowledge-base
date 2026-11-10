require "rails_helper"

# features/14_review_date_recalc. After a review, the next review date is the user's today
# plus the interval the note has at the review (spec question 1; requirements.md 3.5). Each
# test travels to noon UTC of the days it names, for a user with no saved zone, so "today" is
# that UTC date. Each note is due on the day of its review.
RSpec.describe Note, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:work) { user.collections.create!(name: "Work") }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # Noon UTC of the day: "today" is that day for a user with no saved zone.
  def travel_to_noon_of(day)
    travel_to Time.utc(day.year, day.month, day.day, 12)
  end

  # A note of the user with the given schedule, due on the given day.
  def note_due(day, **schedule)
    user.notes.create!(collection: work, title: "Rails tips", body: "Use bin/rails.", next_review_date: day, **schedule)
  end

  # The next review date that a review on the day gives a note due that day.
  def next_review_after_review_on(day, **schedule)
    travel_to_noon_of(day)
    note = note_due(day, **schedule)
    note.mark_reviewed!
    note.reload.next_review_date
  end

  it "AC-14 a monthly review keeps the day number or takes the month's last day, so a monthly note drifts" do
    {
      Date.new(2026, 1, 31) => Date.new(2026, 2, 28),
      Date.new(2028, 1, 31) => Date.new(2028, 2, 29),
      Date.new(2026, 3, 31) => Date.new(2026, 4, 30)
    }.each do |day, next_review|
      expect(next_review_after_review_on(day, review_interval: "monthly")).to eq(next_review)
    end

    # Reviewed on each of its next review dates, a monthly note drifts: Jan 31, Feb 28, then
    # Mar 28, not Mar 31 (spec question 2).
    travel_to_noon_of(Date.new(2026, 1, 31))
    note = note_due(Date.new(2026, 1, 31), review_interval: "monthly")
    note.mark_reviewed!
    expect(note.reload.next_review_date).to eq(Date.new(2026, 2, 28))

    travel_to_noon_of(Date.new(2026, 2, 28))
    note.mark_reviewed!
    expect(note.reload.next_review_date).to eq(Date.new(2026, 3, 28))
  end

  it "AC-14 a review may give a date in the next year, and the custom interval counts its 1 to 365 days" do
    [
      [ Date.new(2026, 12, 28), { review_interval: "weekly" }, Date.new(2027, 1, 4) ],
      [ Date.new(2026, 12, 15), { review_interval: "monthly" }, Date.new(2027, 1, 15) ],
      [ Date.new(2026, 11, 9), { review_interval: "custom", review_interval_days: 1 }, Date.new(2026, 11, 10) ],
      [ Date.new(2026, 11, 9), { review_interval: "custom", review_interval_days: 365 }, Date.new(2027, 11, 9) ]
    ].each do |day, schedule, next_review|
      expect(next_review_after_review_on(day, **schedule)).to eq(next_review)
    end
  end
end

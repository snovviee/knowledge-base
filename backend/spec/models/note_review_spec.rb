require "rails_helper"

# features/12_review_interval_setting. A note's review schedule: the interval, the
# custom number of days, and the next review date (requirements.md 3.4, 3.5). The time
# is fixed at 2026-11-09 20:00 UTC, an hour where the zone changes the date: it is
# 2026-11-10 in Tokyo.
RSpec.describe Note, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada", time_zone: "Asia/Tokyo") }
  let(:work) { user.collections.create!(name: "Work") }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # A saved note of the user with the given schedule.
  def note_with(**schedule)
    user.notes.create!(collection: work, title: "Rails tips", body: "Use bin/rails.", **schedule).reload
  end

  it "AC-12 a schedule without a date gets the user's today plus one day, seven days, or the custom days" do
    expect(note_with(review_interval: "daily").next_review_date).to eq(Date.new(2026, 11, 11))
    expect(note_with(review_interval: "weekly").next_review_date).to eq(Date.new(2026, 11, 17))
    expect(note_with(review_interval: "custom", review_interval_days: 10).next_review_date).to eq(Date.new(2026, 11, 20))
    expect(note_with(review_interval: "weekly", next_review_date: nil).next_review_date).to eq(Date.new(2026, 11, 17))
  end

  it "AC-12 a monthly schedule gets the same day next month, or that month's last day" do
    {
      Date.new(2026, 11, 9) => Date.new(2026, 12, 9),
      Date.new(2026, 1, 31) => Date.new(2026, 2, 28),
      Date.new(2028, 1, 31) => Date.new(2028, 2, 29),
      Date.new(2026, 3, 31) => Date.new(2026, 4, 30)
    }.each do |today, next_review|
      # Noon of that day in Tokyo, the user's zone.
      travel_to Time.find_zone!("Asia/Tokyo").local(today.year, today.month, today.day, 12)

      expect(note_with(review_interval: "monthly").next_review_date).to eq(next_review)
    end
  end

  it "AC-12 a schedule keeps the next review date it is given, a past one included" do
    expect(note_with(review_interval: "weekly", next_review_date: "2026-11-20").next_review_date).to eq(Date.new(2026, 11, 20))
    expect(note_with(review_interval: "weekly", next_review_date: "2026-11-02").next_review_date).to eq(Date.new(2026, 11, 2))
    expect(note_with(review_interval: "monthly", next_review_date: Date.new(2026, 11, 2)).next_review_date).to eq(Date.new(2026, 11, 2))
  end

  it "AC-12 the interval none removes the next review date and the days and keeps the last reviewed date" do
    note = note_with(
      review_interval: "custom", review_interval_days: 10, next_review_date: "2026-11-19", last_reviewed_date: "2026-11-02"
    )

    note.update!(review_interval: "none")

    expect(note.reload).to have_attributes(
      review_interval: "none", review_interval_days: nil, next_review_date: nil, last_reviewed_date: Date.new(2026, 11, 2)
    )

    # Days or a date given with none are dropped as well.
    expect(note_with(review_interval: "none", review_interval_days: 12, next_review_date: "2026-11-20"))
      .to have_attributes(review_interval_days: nil, next_review_date: nil)
  end

  it "AC-12 the custom days are kept only while the interval is custom" do
    note = note_with(review_interval: "custom", review_interval_days: 10, next_review_date: "2026-11-19")

    note.update!(review_interval: "weekly")

    expect(note.reload).to have_attributes(review_interval: "weekly", review_interval_days: nil, next_review_date: Date.new(2026, 11, 19))
    expect(note_with(review_interval: "weekly", review_interval_days: 12)).to have_attributes(
      review_interval_days: nil, next_review_date: Date.new(2026, 11, 17)
    )
  end
end

require "rails_helper"

# features/12_review_interval_setting. "Today" is the date in the user's saved time
# zone, and in UTC while none is saved (spec question 1). The time is fixed at an hour
# where the zone changes the date: 2026-11-09 20:00 UTC is 2026-11-10 in Tokyo.
RSpec.describe User, type: :model do
  include ActiveSupport::Testing::TimeHelpers

  after { travel_back }

  def user_in(time_zone)
    User.new(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada", time_zone: time_zone)
  end

  it "AC-12 today is the date in the user's saved time zone, and in UTC without one" do
    travel_to Time.utc(2026, 11, 9, 20, 0)

    expect(user_in("Asia/Tokyo").today).to eq(Date.new(2026, 11, 10))
    expect(user_in("America/New_York").today).to eq(Date.new(2026, 11, 9))
    expect(user_in(nil).today).to eq(Date.new(2026, 11, 9))

    # One hour after midnight UTC, it is still the day before in New York.
    travel_to Time.utc(2026, 11, 10, 1, 0)

    expect(user_in("America/Los_Angeles").today).to eq(Date.new(2026, 11, 9))
    expect(user_in(nil).today).to eq(Date.new(2026, 11, 10))
  end
end

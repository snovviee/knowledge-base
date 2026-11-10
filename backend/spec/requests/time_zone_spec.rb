require "rails_helper"

# features/12_review_interval_setting. The app's session check reports the browser's
# time zone in the X-Time-Zone header, and the server saves it on the signed-in user:
# "today" is the date in that zone (spec questions 1 and 19). The time is fixed at
# 2026-11-09 20:00 UTC, which is 2026-11-10 in Tokyo and 2026-11-09 in New York.
RSpec.describe "Time zone", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  def json_body(from = response)
    JSON.parse(from.body)
  end

  # The user that sign_in_with_google signs in by default.
  def ada
    User.find_by!(provider: "google_oauth2", provider_user_id: "u-1")
  end

  # The session check as the app sends it, with the browser's zone when it names one.
  def check_session(time_zone, browser = integration_session)
    browser.get "/api/session", headers: { "X-Time-Zone" => time_zone }.compact
  end

  # Creates a weekly note with no date, and returns its next review date: the user's
  # today plus 7 days.
  def weekly_note_date(browser = integration_session)
    work = ada.collections.find_or_create_by!(name: "Work")
    browser.post "/api/notes",
      params: { title: "Weekly note", body: "B", collection_id: work.id, review_interval: "weekly" },
      headers: { "X-CSRF-Token" => csrf_token(browser) }, as: :json
    JSON.parse(browser.response.body)["note"]["next_review_date"]
  end

  it "AC-12 GET /api/session saves the browser's time zone, and the browser that loads last decides" do
    # No one is signed in: 401, and nothing is saved.
    check_session("Asia/Tokyo")
    expect(response).to have_http_status(:unauthorized)
    expect(json_body).to eq("error" => "unauthenticated")

    sign_in_with_google
    check_session("Asia/Tokyo")

    expect(response).to have_http_status(:ok)
    expect(json_body).to eq("user" => { "id" => ada.id, "display_name" => "Ada Lovelace" })
    expect(ada.time_zone).to eq("Asia/Tokyo")
    expect(weekly_note_date).to eq("2026-11-17")

    # Another browser of the same user, in New York, loads the app later.
    other = open_session
    sign_in_with_google(other)
    check_session("America/New_York", other)

    expect(other.response).to have_http_status(:ok)
    expect(ada.time_zone).to eq("America/New_York")
    expect(weekly_note_date).to eq("2026-11-16")
  end

  it "AC-12 a time zone the server does not know makes today UTC" do
    sign_in_with_google

    # A name the tz database does not have, one in the wrong case, and a header value
    # that is not ASCII, as a header can carry it.
    [ "Mars/Base", "asia/tokyo", "Europe/Z\xFCrich".b ].each do |unknown|
      check_session("Asia/Tokyo")
      expect(ada.time_zone).to eq("Asia/Tokyo")

      check_session(unknown)

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("user" => { "id" => ada.id, "display_name" => "Ada Lovelace" })
      expect(ada.time_zone).to be_nil
      expect(weekly_note_date).to eq("2026-11-16")
    end
  end

  it "AC-12 a session check without X-Time-Zone keeps the saved zone" do
    sign_in_with_google
    check_session("Asia/Tokyo")

    # A client that names no zone, such as curl, and an empty header.
    [ nil, "" ].each do |no_zone|
      check_session(no_zone)

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("user" => { "id" => ada.id, "display_name" => "Ada Lovelace" })
      expect(ada.time_zone).to eq("Asia/Tokyo")
    end
    expect(weekly_note_date).to eq("2026-11-17")
  end

  # Chromium reports some zones by their old names, which the tz database keeps as links
  # to the current ones: Asia/Calcutta for Asia/Kolkata, Europe/Kiev for Europe/Kyiv,
  # Asia/Saigon, America/Buenos_Aires, and Asia/Katmandu (Verify of 2026-11-09).
  it "AC-12 a legacy zone name the browser reports is known: a session check with X-Time-Zone Asia/Calcutta saves it, and today follows it" do
    sign_in_with_google

    # 2026-11-09 20:00 UTC is 2026-11-10 01:30 in Kolkata. UTC would give 2026-11-16.
    check_session("Asia/Calcutta")

    expect(response).to have_http_status(:ok)
    expect(json_body).to eq("user" => { "id" => ada.id, "display_name" => "Ada Lovelace" })
    expect(ada.time_zone).to eq("Asia/Calcutta")
    expect(weekly_note_date).to eq("2026-11-17")

    # 2026-11-09 23:00 UTC is 2026-11-10 01:00 in Kyiv. UTC would give 2026-11-16.
    travel_to Time.utc(2026, 11, 9, 23, 0)
    check_session("Europe/Kiev")

    expect(response).to have_http_status(:ok)
    expect(ada.time_zone).to eq("Europe/Kiev")
    expect(weekly_note_date).to eq("2026-11-17")

    [ "Asia/Saigon", "America/Buenos_Aires", "Asia/Katmandu" ].each do |old_name|
      check_session(old_name)

      expect(ada.time_zone).to eq(old_name)
    end
  end
end

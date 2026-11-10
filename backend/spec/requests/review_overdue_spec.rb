require "rails_helper"

# features/16_review_overdue. The list can show only the overdue notes: active, with a
# schedule, and dated before the user's today (spec question 2). A browser signs in through
# the real callback, and a request that changes data sends this session's anti-forgery token,
# as the app does (spec/support/request_helpers.rb). The time is fixed at 2026-11-09 20:00 UTC,
# an hour where the zone changes the date (2026-11-10 in Tokyo). The signed-in user has no
# saved zone unless a test gives one, so "today" is 2026-11-09 (UTC).
RSpec.describe "Review overdue", type: :request do
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

  # Another user, who signs in with GitHub.
  def grace
    User.find_or_create_by!(provider: "github", provider_user_id: "42") { |user| user.display_name = "Grace" }
  end

  # A note of the user, in their "Work" collection, with the given schedule and fields.
  def note_for(user, title, **fields)
    work = user.collections.find_or_create_by!(name: "Work")
    user.notes.create!(collection: work, title: title, body: "Body of #{title}", **fields)
  end

  # A weekly note of the user with the given next review date.
  def weekly(user, title, date, **fields)
    note_for(user, title, review_interval: "weekly", next_review_date: date, **fields)
  end

  # The titles of the listed notes, in the answer's order.
  def listed_titles
    json_body["notes"].map { |note| note["title"] }
  end

  # The review state of each listed note, by title.
  def listed_states
    json_body["notes"].to_h { |note| [ note["title"], note.fetch("review_state") ] }
  end

  describe "GET /api/notes?review=overdue" do
    it "AC-16 GET /api/notes?review=overdue lists only the overdue notes, newest first" do
      sign_in_with_google
      weekly(ada, "Old idea", "2026-11-02", created_at: 5.minutes.ago)
      weekly(ada, "Archived idea", "2026-11-02", status: "archived", created_at: 4.minutes.ago)
      note_for(ada, "Someday", created_at: 3.minutes.ago)
      weekly(ada, "Rails tips", "2026-11-09", created_at: 2.minutes.ago)
      weekly(ada, "Older idea", "2026-10-01", created_at: 1.minute.ago)
      weekly(grace, "Grace late", "2026-11-06")

      get "/api/notes", params: { review: "overdue" }

      expect(response).to have_http_status(:ok)
      expect(listed_titles).to eq([ "Older idea", "Old idea" ])
      expect(json_body["notes"].map { |note| note["review_state"] }).to eq([ "overdue", "overdue" ])
    end

    it "AC-16 an unknown review value is still refused, and review=overdue needs a sign-in" do
      # No sign-in: 401 before anything else.
      get "/api/notes", params: { review: "overdue" }

      expect(response).to have_http_status(:unauthorized)
      expect(json_body).to eq("error" => "unauthenticated")

      sign_in_with_google
      weekly(ada, "Old idea", "2026-11-02")

      # A value no feature adds, and another letter case.
      [ "late", "Overdue" ].each do |value|
        get "/api/notes", params: { review: value }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "review" => "invalid" })
      end

      get "/api/notes", params: { review: "overdue" }

      expect(response).to have_http_status(:ok)
      expect(listed_titles).to eq([ "Old idea" ])
    end
  end

  describe "today" do
    it "AC-16 overdue follows today in the user's saved time zone, and a past date is overdue at once" do
      sign_in_with_google
      # The app's session check reports the browser's zone, and the server saves it
      # (features/12_review_interval_setting question 1). It is 2026-11-10 in Tokyo.
      get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }
      rails_tips = weekly(ada, "Rails tips", "2026-11-09")

      get "/api/notes"

      expect(listed_states).to eq("Rails tips" => "overdue")

      get "/api/notes", params: { review: "overdue" }

      expect(listed_titles).to eq([ "Rails tips" ])

      # Another user, in another browser, with no saved zone: today is 2026-11-09 (UTC).
      charles = open_session
      sign_in_with_google(charles, uid: "u-3", name: "Charles")
      weekly(User.find_by!(provider_user_id: "u-3"), "Same date", "2026-11-09")

      charles.get "/api/notes"

      expect(json_body(charles.response)["notes"].map { |note| [ note["title"], note["review_state"] ] }).to eq(
        [ [ "Same date", "due_today" ] ]
      )

      charles.get "/api/notes", params: { review: "overdue" }

      expect(charles.response).to have_http_status(:ok)
      expect(json_body(charles.response)["notes"]).to eq([])

      # A next review date set in the past: the created note is overdue at once.
      post "/api/notes", params: {
        title: "Late start", body: "B", collection_id: rails_tips.collection_id,
        review_interval: "weekly", next_review_date: "2026-11-02"
      }, headers: { "X-CSRF-Token" => csrf_token }, as: :json

      expect(response).to have_http_status(:created)
      expect(json_body["note"]).to include("next_review_date" => "2026-11-02", "review_state" => "overdue")
    end
  end
end

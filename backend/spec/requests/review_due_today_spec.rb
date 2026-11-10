require "rails_helper"

# features/15_review_due_today. Every note in an answer carries its review state on the
# user's today: "due_today", "overdue", or null (spec question 2). A browser signs in through
# the real callback, and a request that changes data sends this session's anti-forgery token,
# as the app does (spec/support/request_helpers.rb). The time is fixed at 2026-11-09 20:00 UTC,
# an hour where the zone changes the date (2026-11-10 in Tokyo). The signed-in user has no
# saved zone unless a test gives one, so "today" is 2026-11-09 (UTC).
RSpec.describe "Review due today", type: :request do
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

  # The review state of each listed note, by title.
  def listed_states
    json_body["notes"].to_h { |note| [ note["title"], note.fetch("review_state") ] }
  end

  # The titles of the listed notes, in the answer's order.
  def listed_titles
    json_body["notes"].map { |note| note["title"] }
  end

  # Ada's notes of the scenario "Show only the notes due today", oldest first: "Rails tips"
  # and "Ruby tips" are due today, the others are not. Grace has a note due today too.
  def make_notes_of_the_scenario
    weekly(ada, "Rails tips", "2026-11-09", created_at: 6.minutes.ago)
    weekly(ada, "Tomorrow tip", "2026-11-10", created_at: 5.minutes.ago)
    weekly(ada, "Late tip", "2026-11-08", created_at: 4.minutes.ago)
    weekly(ada, "Archived tip", "2026-11-09", status: "archived", created_at: 3.minutes.ago)
    note_for(ada, "Someday", created_at: 2.minutes.ago)
    weekly(ada, "Ruby tips", "2026-11-09", created_at: 1.minute.ago)
    weekly(grace, "Grace due", "2026-11-09")
  end

  describe "the review state of a note" do
    it "AC-15 every note answer carries review_state: due_today, overdue, or null" do
      sign_in_with_google
      rails_tips = weekly(ada, "Rails tips", "2026-11-09")
      late_tip = weekly(ada, "Late tip", "2026-11-08")
      weekly(ada, "Tomorrow tip", "2026-11-10")
      weekly(ada, "Archived tip", "2026-11-09", status: "archived")
      note_for(ada, "Someday")

      get "/api/notes"

      expect(response).to have_http_status(:ok)
      expect(listed_states).to eq(
        "Someday" => nil, "Archived tip" => nil, "Tomorrow tip" => nil, "Late tip" => "overdue", "Rails tips" => "due_today"
      )

      get "/api/notes/#{rails_tips.id}"

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("title" => "Rails tips", "review_state" => "due_today")

      token = csrf_token
      post "/api/notes", params: {
        title: "Due create", body: "B", collection_id: rails_tips.collection_id,
        review_interval: "weekly", next_review_date: "2026-11-09"
      }, headers: { "X-CSRF-Token" => token }, as: :json

      expect(response).to have_http_status(:created)
      expect(json_body["note"]).to include("title" => "Due create", "review_state" => "due_today")

      patch "/api/notes/#{rails_tips.id}", params: { status: "archived" }, headers: { "X-CSRF-Token" => token }, as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("status" => "archived", "review_state" => nil)

      # A review counts from today: the new date is 2026-11-16, so the note is neither.
      post "/api/notes/#{late_tip.id}/review", headers: { "X-CSRF-Token" => token }

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("next_review_date" => "2026-11-16", "review_state" => nil)
    end
  end

  describe "GET /api/notes with review" do
    it "AC-15 GET /api/notes?review=due_today lists only the notes due today, newest first, and an empty review lists all" do
      sign_in_with_google
      make_notes_of_the_scenario

      get "/api/notes", params: { review: "due_today" }

      expect(response).to have_http_status(:ok)
      expect(listed_titles).to eq([ "Ruby tips", "Rails tips" ])
      expect(json_body["notes"].map { |note| note["review_state"] }).to eq([ "due_today", "due_today" ])

      # Left out or empty, review does not filter: all of Ada's notes, newest first.
      all_of_adas = [ "Ruby tips", "Someday", "Archived tip", "Late tip", "Tomorrow tip", "Rails tips" ]

      get "/api/notes"

      expect(response).to have_http_status(:ok)
      expect(listed_titles).to eq(all_of_adas)

      get "/api/notes?review="

      expect(response).to have_http_status(:ok)
      expect(listed_titles).to eq(all_of_adas)
    end

    it "AC-15 an unknown review value answers 422 invalid" do
      sign_in_with_google
      make_notes_of_the_scenario

      # A value no feature adds, another letter case, and a list.
      [ "review=soon", "review=Due_Today", "review%5B%5D=due_today" ].each do |query|
        get "/api/notes?#{query}"

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "review" => "invalid" })
      end
    end

    it "AC-15 a list request without a sign-in answers 401 whatever the review value" do
      [ "review=due_today", "review=soon" ].each do |query|
        get "/api/notes?#{query}"

        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")
      end
    end
  end

  describe "today" do
    it "AC-15 due today follows the user's saved time zone, and UTC for a zone the server does not know" do
      sign_in_with_google
      weekly(ada, "Yesterday in Tokyo", "2026-11-09", created_at: 1.minute.ago)
      weekly(ada, "Rails tips", "2026-11-10")

      # The app's session check reports the browser's zone, and the server saves it
      # (features/12_review_interval_setting question 1). It is 2026-11-10 in Tokyo.
      get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }
      get "/api/notes"

      expect(listed_states).to eq("Rails tips" => "due_today", "Yesterday in Tokyo" => "overdue")

      get "/api/notes", params: { review: "due_today" }

      expect(listed_titles).to eq([ "Rails tips" ])

      # A zone the server does not know saves none, so today is 2026-11-09 (UTC).
      get "/api/session", headers: { "X-Time-Zone" => "Mars/Base" }
      get "/api/notes"

      expect(listed_states).to eq("Rails tips" => nil, "Yesterday in Tokyo" => "due_today")

      get "/api/notes", params: { review: "due_today" }

      expect(listed_titles).to eq([ "Yesterday in Tokyo" ])
    end
  end
end

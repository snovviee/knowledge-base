require "rails_helper"

# features/14_review_date_recalc. After a review, the next review date is the user's today
# plus the interval the note has at the review (spec question 1; requirements.md 3.5). The
# review request is feature 13's: POST /api/notes/:id/review. A browser signs in through the
# real callback, and a request that changes data sends this session's anti-forgery token, as
# the app does (spec/support/request_helpers.rb). The time is fixed at 2026-11-09 20:00 UTC,
# an hour where the zone changes the date (2026-11-10 in Tokyo). The signed-in user has no
# saved zone unless a test gives one, so "today" is 2026-11-09 (UTC). Each note starts with a
# next review date that differs from today plus its interval, so a test sees the new date.
RSpec.describe "Review date recalc", type: :request do
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

  # Marks a note as reviewed as the app does: no body, and this session's token.
  def review(id, token: csrf_token)
    post "/api/notes/#{id}/review", headers: { "X-CSRF-Token" => token }
  end

  # Edits a note as the app does: PATCH /api/notes/:id with the changed fields only.
  def edit_note(id, fields, token: csrf_token)
    patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
  end

  describe "POST /api/notes/:id/review" do
    it "AC-13 AC-14 marks a note as reviewed and recalculates the next review date by its interval" do
      sign_in_with_google
      token = csrf_token

      # Each note is due 2026-11-12, and gets today plus its interval.
      [
        [ "Daily note", { review_interval: "daily" }, "2026-11-10" ],
        [ "Weekly note", { review_interval: "weekly" }, "2026-11-16" ],
        [ "Monthly note", { review_interval: "monthly" }, "2026-12-09" ],
        [ "Custom note", { review_interval: "custom", review_interval_days: 10 }, "2026-11-19" ]
      ].each do |title, schedule, next_review|
        note = note_for(ada, title, next_review_date: "2026-11-12", **schedule)

        review(note.id, token: token)

        expect(response).to have_http_status(:ok)
        expect(json_body["note"]).to include(
          "title" => title, "last_reviewed_date" => "2026-11-09", "next_review_date" => next_review
        )
        expect(note.reload).to have_attributes(
          last_reviewed_date: Date.new(2026, 11, 9), next_review_date: Date.parse(next_review)
        )
      end
    end

    it "AC-14 the new date counts from the review day, for an overdue note and for an early review" do
      sign_in_with_google
      token = csrf_token

      # Overdue since 2026-11-02, or due 2026-11-12: each gets today plus one week.
      [ [ "Old idea", "2026-11-02" ], [ "Rails tips", "2026-11-12" ] ].each do |title, due|
        note = note_for(ada, title, review_interval: "weekly", next_review_date: due)

        review(note.id, token: token)

        expect(response).to have_http_status(:ok)
        expect(json_body["note"]).to include("title" => title, "next_review_date" => "2026-11-16")
        expect(note.reload.next_review_date).to eq(Date.new(2026, 11, 16))
      end
    end

    it "AC-14 a note with the interval none keeps no next review date after a review" do
      sign_in_with_google
      note = note_for(ada, "Someday")

      review(note.id)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include(
        "last_reviewed_date" => "2026-11-09", "next_review_date" => nil,
        "review_interval" => "none", "review_interval_days" => nil
      )
      expect(note.reload).to have_attributes(
        review_interval: "none", next_review_date: nil, last_reviewed_date: Date.new(2026, 11, 9)
      )
    end

    it "AC-14 an archived note gets a new next review date and stays archived" do
      sign_in_with_google
      # Archived, and overdue since 2026-11-02.
      note = note_for(ada, "Old idea", status: "archived", review_interval: "weekly", next_review_date: "2026-11-02")

      review(note.id)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include(
        "status" => "archived", "last_reviewed_date" => "2026-11-09", "next_review_date" => "2026-11-16"
      )
      expect(note.reload).to have_attributes(status: "archived", next_review_date: Date.new(2026, 11, 16))
    end

    it "AC-14 the new dates count from today in the user's saved time zone, and in UTC when the zone is unknown" do
      sign_in_with_google
      # The app's session check reports the browser's zone, and the server saves it
      # (features/12_review_interval_setting question 1). It is 2026-11-10 in Tokyo.
      get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }
      tokyo = note_for(ada, "Zone K", review_interval: "weekly", next_review_date: "2026-11-12")

      review(tokyo.id)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("last_reviewed_date" => "2026-11-10", "next_review_date" => "2026-11-17")
      expect(tokyo.reload).to have_attributes(
        last_reviewed_date: Date.new(2026, 11, 10), next_review_date: Date.new(2026, 11, 17)
      )

      # A zone the server does not know saves none, so today is 2026-11-09 (UTC).
      get "/api/session", headers: { "X-Time-Zone" => "Mars/Base" }
      unknown = note_for(ada, "Zone P", review_interval: "weekly", next_review_date: "2026-11-12")

      review(unknown.id)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("last_reviewed_date" => "2026-11-09", "next_review_date" => "2026-11-16")
      expect(unknown.reload).to have_attributes(
        last_reviewed_date: Date.new(2026, 11, 9), next_review_date: Date.new(2026, 11, 16)
      )
    end

    it "AC-14 the interval the note has at the review decides the new date" do
      sign_in_with_google
      token = csrf_token
      # Weekly and due 2026-11-16. A change to daily keeps the date
      # (features/12_review_interval_setting question 9).
      note = note_for(ada, "Changed", review_interval: "weekly", next_review_date: "2026-11-16")

      edit_note(note.id, { review_interval: "daily" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("review_interval" => "daily", "next_review_date" => "2026-11-16")

      review(note.id, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("review_interval" => "daily", "next_review_date" => "2026-11-10")
      expect(note.reload.next_review_date).to eq(Date.new(2026, 11, 10))
    end

    it "AC-14 a second review on the same day changes nothing, and a date changed by hand in between is set again" do
      sign_in_with_google
      token = csrf_token
      note = note_for(ada, "Twice", review_interval: "weekly", next_review_date: "2026-11-12")

      review(note.id, token: token)

      expect(response).to have_http_status(:ok)
      first = json_body["note"]
      expect(first).to include("last_reviewed_date" => "2026-11-09", "next_review_date" => "2026-11-16")

      # An hour later, it is still 2026-11-09 (UTC): the same note, the updated date included.
      travel 1.hour
      review(note.id, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to eq(first)

      # A date changed by hand is set again to today plus one week.
      edit_note(note.id, { next_review_date: "2026-11-30" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("next_review_date" => "2026-11-30")

      review(note.id, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("last_reviewed_date" => "2026-11-09", "next_review_date" => "2026-11-16")
      expect(note.reload.next_review_date).to eq(Date.new(2026, 11, 16))
    end
  end

  describe "a refused review" do
    it "AC-14 a refused review request changes neither date" do
      secret = note_for(grace, "Secret", review_interval: "weekly", next_review_date: "2026-11-12")
      sign_in_with_google
      note = note_for(ada, "Refused", review_interval: "weekly", next_review_date: "2026-11-12")
      token = csrf_token

      # Another browser, where no one is signed in: 401.
      stranger = open_session
      stranger.post "/api/notes/#{note.id}/review"

      expect(stranger.response).to have_http_status(:unauthorized)
      expect(json_body(stranger.response)).to eq("error" => "unauthenticated")

      # Signed in, with the token, and a body that is not JSON: 400.
      post "/api/notes/#{note.id}/review", params: "{oops", headers: { "X-CSRF-Token" => token, "Content-Type" => "application/json" }

      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      # Signed in, without the token: 403.
      post "/api/notes/#{note.id}/review"

      expect(response).to have_http_status(:forbidden)
      expect(json_body).to eq("error" => "invalid_csrf_token")

      # Signed in, with the token, for another user's note: 404.
      review(secret.id, token: token)

      expect(response).to have_http_status(:not_found)
      expect(json_body).to eq("error" => "not_found")

      [ note, secret ].each do |refused|
        expect(refused.reload).to have_attributes(next_review_date: Date.new(2026, 11, 12), last_reviewed_date: nil)
      end
    end
  end
end

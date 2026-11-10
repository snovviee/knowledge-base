require "rails_helper"

# features/13_mark_reviewed. Marking a note as reviewed: POST /api/notes/:id/review sets
# the note's last reviewed date to the user's today. A browser signs in through the real
# callback, and a request that changes data sends this session's anti-forgery token, as
# the app does (spec/support/request_helpers.rb). The time is fixed at 2026-11-09 20:00
# UTC, an hour where the zone changes the date (2026-11-10 in Tokyo). The signed-in user
# has no saved zone unless a test gives one, so "today" is 2026-11-09 (UTC). Every
# scheduled note here is due today plus its interval, so feature 14's new next review
# date after a review is the date the note already has.
RSpec.describe "Mark reviewed", type: :request do
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

  # A note of the user, in their "Work" collection. The attributes override the defaults.
  def note_for(user, title, **attributes)
    work = user.collections.find_or_create_by!(name: "Work")
    user.notes.create!({ collection: work, title: title, body: "Body of #{title}" }.merge(attributes))
  end

  # The weekly "Rails tips", due 2026-11-16: today plus one week.
  def rails_tips(user = ada, **attributes)
    note_for(user, "Rails tips", review_interval: "weekly", next_review_date: "2026-11-16", **attributes)
  end

  # Marks a note as reviewed as the app does: no body, and this session's token.
  def review(id, token: csrf_token)
    post "/api/notes/#{id}/review", headers: { "X-CSRF-Token" => token }
  end

  describe "POST /api/notes/:id/review" do
    it "AC-13 POST /api/notes/:id/review answers 200 with the note, whose last reviewed date is today" do
      sign_in_with_google
      note = rails_tips

      review(note.id)

      expect(response).to have_http_status(:ok)
      answer = json_body["note"]
      expect(answer).to include("id" => note.id, "title" => "Rails tips", "last_reviewed_date" => "2026-11-09")
      expect(note.reload.last_reviewed_date).to eq(Date.new(2026, 11, 9))

      # The answer is the note's detail, as GET /api/notes/:id gives it right after.
      get "/api/notes/#{note.id}"

      expect(json_body["note"]).to eq(answer)
    end

    it "AC-13 the last reviewed date is today in the user's saved time zone" do
      sign_in_with_google
      # The app's session check reports the browser's zone, and the server saves it
      # (features/12_review_interval_setting question 1). It is 2026-11-10 in Tokyo, so
      # the weekly note gets 2026-11-17.
      get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }
      note = note_for(ada, "Tokyo note", review_interval: "weekly")

      review(note.id)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]["last_reviewed_date"]).to eq("2026-11-10")
      expect(note.reload.last_reviewed_date).to eq(Date.new(2026, 11, 10))
    end

    it "AC-13 a review changes no field but the last reviewed date, the updated date included" do
      sign_in_with_google
      # The note was created, and last changed, on 2026-11-01. Its custom interval of 10
      # days is due 2026-11-19: today plus 10 days.
      travel_to Time.utc(2026, 11, 1, 10, 0)
      note = note_for(
        ada, "Old idea",
        status: "archived", source_url: "https://example.com/rails",
        review_interval: "custom", review_interval_days: 10, next_review_date: "2026-11-19"
      )
      note.add_tag(ada.tags.create!(name: "ruby"))
      travel_to Time.utc(2026, 11, 9, 20, 0)
      before = note.reload.attributes

      review(note.id)

      expect(response).to have_http_status(:ok)
      expect(note.reload.attributes).to eq(before.merge("last_reviewed_date" => Date.new(2026, 11, 9)))
      expect(note.tags.pluck(:name)).to eq([ "ruby" ])
      expect(json_body["note"]).to include(
        "status" => "archived", "last_reviewed_date" => "2026-11-09", "updated_at" => "2026-11-01T10:00:00.000Z"
      )
    end

    it "AC-13 a second review on the same day changes nothing more" do
      sign_in_with_google
      note = rails_tips
      token = csrf_token

      review(note.id, token: token)

      expect(response).to have_http_status(:ok)
      first = json_body["note"]
      stored = note.reload.attributes

      # An hour later, it is still 2026-11-09 (UTC).
      travel 1.hour
      review(note.id, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to eq(first)
      expect(note.reload.attributes).to eq(stored)
    end

    it "AC-13 a note can be marked as reviewed before its next review date, which stays 2026-11-16" do
      sign_in_with_google
      note = rails_tips

      review(note.id)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("last_reviewed_date" => "2026-11-09", "next_review_date" => "2026-11-16")
      expect(note.reload).to have_attributes(
        last_reviewed_date: Date.new(2026, 11, 9), next_review_date: Date.new(2026, 11, 16)
      )
    end

    it "AC-13 an archived note and a note with the interval none can be marked as reviewed" do
      sign_in_with_google
      archived = note_for(ada, "Old idea", status: "archived", review_interval: "weekly", next_review_date: "2026-11-16")
      someday = note_for(ada, "Someday")
      token = csrf_token

      review(archived.id, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("status" => "archived", "last_reviewed_date" => "2026-11-09")
      expect(archived.reload).to have_attributes(status: "archived", last_reviewed_date: Date.new(2026, 11, 9))

      review(someday.id, token: token)

      unscheduled = {
        "review_interval" => "none", "review_interval_days" => nil, "next_review_date" => nil,
        "last_reviewed_date" => "2026-11-09"
      }
      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include(unscheduled)
      expect(someday.reload).to have_attributes(
        review_interval: "none", review_interval_days: nil, next_review_date: nil, last_reviewed_date: Date.new(2026, 11, 9)
      )
    end

    it "AC-13 the review request ignores its body, so a client cannot choose the date" do
      sign_in_with_google
      note = rails_tips
      ruby = ada.tags.create!(name: "ruby")
      note.add_tag(ruby)
      books = ada.collections.create!(name: "Books")
      body = {
        last_reviewed_date: "2020-01-01", title: "Hacked", status: "archived", review_interval: "none",
        review_interval_days: 3, next_review_date: "2020-01-01", collection_id: books.id, tag_ids: []
      }

      post "/api/notes/#{note.id}/review", params: body, headers: { "X-CSRF-Token" => csrf_token }, as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include(
        "last_reviewed_date" => "2026-11-09", "title" => "Rails tips", "status" => "active",
        "review_interval" => "weekly", "review_interval_days" => nil, "next_review_date" => "2026-11-16",
        "collection" => { "id" => note.collection_id, "name" => "Work" }, "tags" => [ { "id" => ruby.id, "name" => "ruby" } ]
      )
      expect(note.reload).to have_attributes(
        title: "Rails tips", status: "active", review_interval: "weekly", review_interval_days: nil,
        next_review_date: Date.new(2026, 11, 16), last_reviewed_date: Date.new(2026, 11, 9)
      )
      expect(note.collection.name).to eq("Work")
      expect(note.tags).to eq([ ruby ])
    end
  end

  describe "a note the user does not have" do
    it "AC-13 a review of another user's note, a deleted one, or an id that is not a number answers 404 and changes nothing" do
      secret = rails_tips(grace)
      sign_in_with_google
      deleted = rails_tips
      deleted.destroy!
      token = csrf_token

      [ secret.id, deleted.id, "not-a-number" ].each do |id|
        review(id, token: token)

        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")
      end

      expect(secret.reload.last_reviewed_date).to be_nil
    end
  end

  describe "the checks before a review" do
    it "AC-13 a review without a sign-in, without this session's token, or with a body that is not JSON answers 401, 403, or 400 and changes nothing" do
      sign_in_with_google
      note = rails_tips
      token = csrf_token

      # Another browser, where no one is signed in: 401, with or without its own token.
      stranger = open_session
      [ {}, { "X-CSRF-Token" => csrf_token(stranger) } ].each do |headers|
        stranger.post "/api/notes/#{note.id}/review", headers: headers

        expect(stranger.response).to have_http_status(:unauthorized)
        expect(json_body(stranger.response)).to eq("error" => "unauthenticated")
      end

      # Signed in, with no token or with another session's token: 403.
      [ {}, { "X-CSRF-Token" => csrf_token(open_session) } ].each do |headers|
        post "/api/notes/#{note.id}/review", headers: headers

        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")
      end

      # Signed in, with the token, and a body that is not JSON: 400.
      post "/api/notes/#{note.id}/review", params: "{", headers: { "X-CSRF-Token" => token, "Content-Type" => "application/json" }

      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      # A sign-in that has ended (a logout deletes it, features/05_logout) counts as no one.
      SignIn.delete_all
      review(note.id, token: token)

      expect(response).to have_http_status(:unauthorized)
      expect(json_body).to eq("error" => "unauthenticated")
      expect(note.reload.last_reviewed_date).to be_nil
    end

    it "AC-13 a review request that breaks several checks gets 401, then 400, then 403, then 404" do
      secret = rails_tips(grace)
      not_json = { "Content-Type" => "application/json" }

      # No sign-in, a body that is not JSON, and no token: 401.
      post "/api/notes/#{secret.id}/review", params: "{oops", headers: not_json

      expect(response).to have_http_status(:unauthorized)
      expect(json_body).to eq("error" => "unauthenticated")

      # Signed in, a body that is not JSON, and no token, for another user's note: 400.
      sign_in_with_google
      post "/api/notes/#{secret.id}/review", params: "{oops", headers: not_json

      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      # Signed in, no body, and no token, for another user's note: 403.
      post "/api/notes/#{secret.id}/review"

      expect(response).to have_http_status(:forbidden)
      expect(json_body).to eq("error" => "invalid_csrf_token")

      # Signed in, with the token, for another user's note: 404.
      review(secret.id)

      expect(response).to have_http_status(:not_found)
      expect(json_body).to eq("error" => "not_found")
      expect(secret.reload.last_reviewed_date).to be_nil
    end
  end
end

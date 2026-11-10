require "rails_helper"

# features/12_review_interval_setting. A note's review schedule in the notes API: the
# interval, the custom number of days, and the next review date. A browser signs in
# through the real callback, and a request that changes data sends this session's
# anti-forgery token, as the app does (spec/support/request_helpers.rb). The time is
# fixed at 2026-11-09 20:00 UTC, an hour where the zone changes the date. The signed-in
# user has no saved zone unless a test gives one, so "today" is 2026-11-09 (UTC).
RSpec.describe "Review interval", type: :request do
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

  def grace
    User.find_or_create_by!(provider: "github", provider_user_id: "42") { |user| user.display_name = "Grace" }
  end

  # A note of the user, in their "Work" collection. The attributes override the defaults.
  def note_for(user, title, **attributes)
    work = user.collections.find_or_create_by!(name: "Work")
    user.notes.create!({ collection: work, title: title, body: "Body of #{title}" }.merge(attributes))
  end

  # Creates a note as the app does: a JSON body and this session's token.
  def create_note(body, token: csrf_token)
    post "/api/notes", params: body, headers: { "X-CSRF-Token" => token }, as: :json
  end

  # Edits a note as the app does: a JSON body and this session's token.
  def edit_note(id, fields, token: csrf_token)
    patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
  end

  # The review fields of a note with no schedule.
  def no_schedule
    { "review_interval" => "none", "review_interval_days" => nil, "next_review_date" => nil, "last_reviewed_date" => nil }
  end

  describe "the review fields in every answer" do
    it "AC-12 every note answer carries the review fields, and a new note has the interval none" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      token = csrf_token

      # A create without an interval. A last reviewed date in the body changes nothing.
      create_note({ title: "Plain", body: "B", collection_id: work.id, last_reviewed_date: "2020-01-01" }, token: token)

      expect(response).to have_http_status(:created)
      expect(json_body["note"]).to include(no_schedule)
      plain = ada.notes.find(json_body["note"]["id"])
      expect(plain.last_reviewed_date).to be_nil

      scheduled = note_for(
        ada, "Scheduled",
        review_interval: "custom", review_interval_days: 10, next_review_date: "2026-11-19", last_reviewed_date: "2026-11-02"
      )
      schedule = {
        "review_interval" => "custom", "review_interval_days" => 10,
        "next_review_date" => "2026-11-19", "last_reviewed_date" => "2026-11-02"
      }

      get "/api/notes"

      listed = json_body["notes"].index_by { |note| note["id"] }
      expect(listed[plain.id]).to include(no_schedule)
      expect(listed[scheduled.id]).to include(schedule)

      get "/api/notes/#{scheduled.id}"

      expect(json_body["note"]).to include(schedule)

      edit_note(scheduled.id, { title: "Scheduled again" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include(schedule.merge("title" => "Scheduled again"))
    end
  end

  describe "POST /api/notes with a review schedule" do
    it "AC-12 POST /api/notes with a weekly interval and no date answers today plus 7 days" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")

      create_note({ title: "Weekly note", body: "B", collection_id: work.id, review_interval: "weekly" })

      expect(response).to have_http_status(:created)
      expect(json_body["note"]).to include(
        "review_interval" => "weekly", "review_interval_days" => nil, "next_review_date" => "2026-11-16", "last_reviewed_date" => nil
      )
      expect(ada.notes.find(json_body["note"]["id"]).next_review_date).to eq(Date.new(2026, 11, 16))
    end

    it "AC-12 POST /api/notes with the custom interval and 10 days answers today plus 10 days" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")

      create_note({ title: "Custom note", body: "B", collection_id: work.id, review_interval: "custom", review_interval_days: 10 })

      expect(response).to have_http_status(:created)
      expect(json_body["note"]).to include(
        "review_interval" => "custom", "review_interval_days" => 10, "next_review_date" => "2026-11-19"
      )
      expect(ada.notes.find(json_body["note"]["id"])).to have_attributes(review_interval_days: 10, next_review_date: Date.new(2026, 11, 19))
    end

    it "AC-12 POST /api/notes keeps a given next review date, a past one included" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      token = csrf_token

      # A date the user picked, and one in the past: the note is overdue at once (AC-16).
      %w[2026-11-20 2026-11-02].each do |date|
        create_note({ title: "Picked date", body: "B", collection_id: work.id, review_interval: "weekly", next_review_date: date }, token: token)

        expect(response).to have_http_status(:created)
        expect(json_body["note"]).to include("review_interval" => "weekly", "next_review_date" => date)
        expect(ada.notes.find(json_body["note"]["id"]).next_review_date).to eq(Date.iso8601(date))
      end
    end
  end

  describe "refused review fields" do
    it "AC-12 an unknown review interval answers 422 invalid and changes nothing" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      note = note_for(ada, "Weekly note", review_interval: "weekly")
      token = csrf_token
      refused = { "error" => "validation_failed", "fields" => { "review_interval" => "invalid" } }

      # Values the API does not know, null and values that are not text included.
      [ "yearly", "Weekly", 7, nil, true, [ "weekly" ], { "value" => "weekly" } ].each do |interval|
        expect { create_note({ title: "T", body: "B", collection_id: work.id, review_interval: interval }, token: token) }
          .not_to change(Note, :count)
        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq(refused)

        expect { edit_note(note.id, { review_interval: interval }, token: token) }.not_to change { note.reload.attributes }
        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq(refused)
      end

      # Every field that breaks a rule is named in the same answer.
      create_note({ title: " ", body: "B", collection_id: work.id, review_interval: "yearly" }, token: token)

      expect(json_body).to eq("error" => "validation_failed", "fields" => { "title" => "blank", "review_interval" => "invalid" })
      expect(ada.notes.pluck(:title)).to eq([ "Weekly note" ])
    end

    it "AC-12 the custom days must be a JSON integer from 1 to 365" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      token = csrf_token
      # The body is sent as JSON text, so that 7.0 stays a number with a fraction. nil
      # leaves the days out of the body.
      create_custom = lambda do |days|
        days_member = days.nil? ? "" : %(,"review_interval_days":#{days})
        post "/api/notes",
          params: %({"title":"T","body":"B","collection_id":#{work.id},"review_interval":"custom"#{days_member}}),
          headers: { "X-CSRF-Token" => token, "Content-Type" => "application/json" }
      end

      {
        nil => "blank", "null" => "blank",
        "0" => "invalid", "366" => "invalid", "-7" => "invalid", "1.5" => "invalid", "7.0" => "invalid",
        '"7"' => "invalid", "true" => "invalid", "[7]" => "invalid", '{"days":7}' => "invalid"
      }.each do |days, code|
        expect { create_custom.(days) }.not_to change(Note, :count)
        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "review_interval_days" => code })
      end

      # The ends of the range are accepted.
      { "1" => "2026-11-10", "365" => "2027-11-09" }.each do |days, date|
        expect { create_custom.(days) }.to change(Note, :count).by(1)
        expect(response).to have_http_status(:created)
        expect(json_body["note"]).to include("review_interval_days" => days.to_i, "next_review_date" => date)
      end
    end

    it "AC-12 a next review date must be a real date written YYYY-MM-DD, and is ignored with the interval none" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      token = csrf_token

      # No date is computed in place of a refused one: nothing is created.
      [
        "20261109", "2026-02-30", "tomorrow", "", 20261109, "2026-11-9", " 2026-11-20", "2026-11-20T10:00:00Z", [ "2026-11-20" ]
      ].each do |date|
        expect { create_note({ title: "T", body: "B", collection_id: work.id, review_interval: "weekly", next_review_date: date }, token: token) }
          .not_to change(Note, :count)
        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "next_review_date" => "invalid" })
      end

      # With the interval none, a date is ignored, even one that is not a date.
      create_note({ title: "T", body: "B", collection_id: work.id, review_interval: "none", next_review_date: "tomorrow" }, token: token)

      expect(response).to have_http_status(:created)
      expect(json_body["note"]).to include(no_schedule)
    end
  end

  describe "PATCH /api/notes/:id with a review schedule" do
    it "AC-12 PATCH with only review_interval keeps the date, schedules a note from today, and removes the schedule with none" do
      sign_in_with_google
      weekly = note_for(ada, "Weekly note", review_interval: "weekly", next_review_date: "2026-11-16")
      plain = note_for(ada, "Plain note")
      reviewed = note_for(ada, "Reviewed note", review_interval: "weekly", next_review_date: "2026-11-16", last_reviewed_date: "2026-11-02")
      token = csrf_token

      # The interval changes, and the date stays.
      edit_note(weekly.id, { review_interval: "daily" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("review_interval" => "daily", "next_review_date" => "2026-11-16")
      expect(weekly.reload).to have_attributes(review_interval: "daily", next_review_date: Date.new(2026, 11, 16))

      # A note with none gets a schedule from today.
      edit_note(plain.id, { review_interval: "weekly" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("review_interval" => "weekly", "next_review_date" => "2026-11-16")

      # None removes the date and the days, and keeps the last reviewed date.
      edit_note(reviewed.id, { review_interval: "none" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include(no_schedule.merge("last_reviewed_date" => "2026-11-02"))
      expect(reviewed.reload).to have_attributes(next_review_date: nil, last_reviewed_date: Date.new(2026, 11, 2))
    end

    it "AC-12 PATCH with next_review_date null restarts the schedule from today" do
      sign_in_with_google
      note = note_for(ada, "Picked date", review_interval: "weekly", next_review_date: "2026-11-20")
      token = csrf_token

      edit_note(note.id, { next_review_date: nil }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("review_interval" => "weekly", "next_review_date" => "2026-11-16")
      expect(note.reload.next_review_date).to eq(Date.new(2026, 11, 16))

      # A date sets that date.
      edit_note(note.id, { next_review_date: "2026-11-23" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("next_review_date" => "2026-11-23")

      # A date that is not a date is refused, and no date is computed in its place.
      expect { edit_note(note.id, { next_review_date: "tomorrow" }, token: token) }.not_to change { note.reload.attributes }
      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "next_review_date" => "invalid" })
      expect(note.next_review_date).to eq(Date.new(2026, 11, 23))
    end

    it "AC-12 PATCH with the days or the date alone follows the note's interval" do
      sign_in_with_google
      custom = note_for(ada, "Custom note", review_interval: "custom", review_interval_days: 10, next_review_date: "2026-11-19")
      weekly = note_for(ada, "Weekly note", review_interval: "weekly", next_review_date: "2026-11-16")
      plain = note_for(ada, "Plain note")
      token = csrf_token

      # The days of a custom note change, and its date stays.
      edit_note(custom.id, { review_interval_days: 5 }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("review_interval" => "custom", "review_interval_days" => 5, "next_review_date" => "2026-11-19")

      # Days are ignored for a weekly note, and a date for a note with none.
      edit_note(weekly.id, { review_interval_days: 5 }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("review_interval" => "weekly", "review_interval_days" => nil, "next_review_date" => "2026-11-16")

      edit_note(plain.id, { next_review_date: "2026-12-01" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include(no_schedule)

      # The days of a custom note are checked as in a create, and a note changed to
      # custom needs its days.
      expect { edit_note(custom.id, { review_interval_days: 0 }, token: token) }.not_to change { custom.reload.attributes }
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "review_interval_days" => "invalid" })

      expect { edit_note(weekly.id, { review_interval: "custom" }, token: token) }.not_to change { weekly.reload.attributes }
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "review_interval_days" => "blank" })

      edit_note(weekly.id, { review_interval: "custom", review_interval_days: 12 }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("review_interval" => "custom", "review_interval_days" => 12, "next_review_date" => "2026-11-16")
    end
  end

  describe "the checks before a review change" do
    it "AC-12 a review change without a sign-in, with a body that is not JSON, without the token, or for another user's note changes nothing" do
      secret = note_for(grace, "Secret plan", review_interval: "weekly", next_review_date: "2026-11-16")
      change = { review_interval: "daily", next_review_date: "2026-11-30" }

      # No sign-in: 401, with or without this browser's token.
      token = csrf_token
      [ {}, { "X-CSRF-Token" => token } ].each do |headers|
        patch "/api/notes/#{secret.id}", params: change, headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")
      end

      sign_in_with_google
      note = note_for(ada, "Weekly note", review_interval: "weekly", next_review_date: "2026-11-16")
      token = csrf_token

      # A body that is not JSON.
      patch "/api/notes/#{note.id}", params: '{"review_interval":', headers: { "X-CSRF-Token" => token, "Content-Type" => "application/json" }
      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      # No token, or another browser's.
      [ {}, { "X-CSRF-Token" => csrf_token(open_session) } ].each do |headers|
        patch "/api/notes/#{note.id}", params: change, headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")
      end

      # Another user's note.
      patch "/api/notes/#{secret.id}", params: change, headers: { "X-CSRF-Token" => token }, as: :json
      expect(response).to have_http_status(:not_found)
      expect(json_body).to eq("error" => "not_found")

      [ note, secret ].each do |unchanged|
        expect(unchanged.reload).to have_attributes(review_interval: "weekly", next_review_date: Date.new(2026, 11, 16))
      end
    end
  end
end

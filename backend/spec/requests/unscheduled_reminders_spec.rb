require "rails_helper"

# features/19_unscheduled_no_reminders. A note with the interval none gets no review reminder
# of either kind: no review state in the notes API, no place under the "Due today" and
# "Overdue" filters (features 15 to 17), and no reminder in a batch (feature 20) (spec question
# 1). A browser signs in through the real callback, and a request that changes data sends this
# session's anti-forgery token, as the app does (spec/support/request_helpers.rb). The time is
# fixed at 2026-11-09 20:00 UTC; the signed-in user has no saved zone, so "today" is
# 2026-11-09 (UTC).
RSpec.describe "Notes without a review schedule and review reminders", type: :request do
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

  # A note of the user in "Work", with the given schedule and fields: the interval none unless
  # the fields name another.
  def note_for(user, title, **fields)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: "Work"), title: title,
                       body: "Body of #{title}", **fields)
  end

  # A weekly note of the user with the given next review date.
  def weekly(user, title, date, **fields)
    note_for(user, title, review_interval: "weekly", next_review_date: date, **fields)
  end

  # A note with the interval none whose row holds this next review date anyway, written
  # straight in the database: the app itself never gives such a note a date (feature 12).
  def stray(user, title, date, **fields)
    note_for(user, title, **fields).tap { |note| note.update_columns(next_review_date: date) }
  end

  # The titles the list answers for this address, in its order.
  def titles_at(path)
    get path
    expect(response).to have_http_status(:ok)
    json_body["notes"].map { |note| note["title"] }
  end

  # The review fields of a note as the API answers it.
  def review_fields_of(note_json)
    note_json.slice("review_interval", "review_interval_days", "next_review_date", "review_state")
  end

  # A change as the app sends it: a JSON body, with this session's anti-forgery token.
  def send_change(method, path, body = nil)
    send(method, path, params: body, headers: { "X-CSRF-Token" => csrf_token }, as: :json)
  end

  # A reminder as a batch holds it (feature 20 question 2), of a note in "Work".
  def reminder(note, title, next_review_date, review_state)
    { type: "review_#{review_state}", note_id: note.id, title: title, collection_name: "Work",
      next_review_date: next_review_date, review_state: review_state }
  end

  # The matcher of one batch with these reminders, in this order, broadcast to the user's
  # subscriptions, in every tab and browser.
  def send_batch_to(user, *reminders)
    have_broadcasted_to(user).from_channel(ReviewRemindersChannel).exactly(:once)
      .with(type: "review_reminders", reminders: reminders)
  end

  it "AC-19 the notes API gives a note with no schedule no review state, and only the No review scheduled filter lists it" do
    sign_in_with_google
    someday = note_for(ada, "Someday", created_at: 3.minutes.ago)
    note_for(ada, "Old someday", status: "archived", created_at: 2.minutes.ago)
    stray(ada, "Stray past", "2026-11-02", created_at: 1.minute.ago)
    # The control: active weekly notes, due today and overdue.
    weekly(ada, "Rails tips", "2026-11-09")
    weekly(ada, "Old idea", "2026-11-02")
    no_schedule = { "review_interval" => "none", "review_interval_days" => nil, "next_review_date" => nil,
                    "review_state" => nil }

    get "/api/notes"
    expect(response).to have_http_status(:ok)
    listed = json_body["notes"].to_h { |note| [ note["title"], review_fields_of(note) ] }
    expect(listed["Someday"]).to eq(no_schedule)
    expect(listed["Old someday"]).to eq(no_schedule)
    expect(listed["Stray past"]).to eq(no_schedule.merge("next_review_date" => "2026-11-02"))
    expect(listed.transform_values { |fields| fields["review_state"] }).to include("Rails tips" => "due_today",
                                                                                   "Old idea" => "overdue")

    get "/api/notes/#{someday.id}"
    expect(response).to have_http_status(:ok)
    expect(review_fields_of(json_body["note"])).to eq(no_schedule)

    expect(titles_at("/api/notes?review=due_today")).to eq([ "Rails tips" ])
    expect(titles_at("/api/notes?review=overdue")).to eq([ "Old idea" ])
    expect(titles_at("/api/notes?review=unscheduled")).to eq([ "Stray past", "Old someday", "Someday" ])
  end

  it "AC-19 creating a note with no schedule or setting a note's interval to none sends a batch without it" do
    sign_in_with_google
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    rails_tips = weekly(ada, "Rails tips", "2026-11-02")
    overdue_old_idea = reminder(old_idea, "Old idea", "2026-11-02", "overdue")

    # A new note with no review_interval has none, and the batch sent right after the create
    # does not hold it.
    expect do
      send_change(:post, "/api/notes", { title: "Fresh idea", body: "B", collection_id: old_idea.collection_id })
    end.to send_batch_to(ada, overdue_old_idea, reminder(rails_tips, "Rails tips", "2026-11-02", "overdue"))
    expect(response).to have_http_status(:created)
    expect(review_fields_of(json_body["note"])).to eq(
      "review_interval" => "none", "review_interval_days" => nil, "next_review_date" => nil, "review_state" => nil
    )

    # "Rails tips" set to none: the batch sent right after the save leaves it out.
    expect { send_change(:patch, "/api/notes/#{rails_tips.id}", { review_interval: "none" }) }
      .to send_batch_to(ada, overdue_old_idea)
    expect(response).to have_http_status(:ok)
    expect(review_fields_of(json_body["note"])).to eq(
      "review_interval" => "none", "review_interval_days" => nil, "next_review_date" => nil, "review_state" => nil
    )
  end

  it "AC-19 a schedule set again is reminded on its new date, at once when that date is today or earlier" do
    sign_in_with_google
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    someday = note_for(ada, "Someday")
    someday_two = note_for(ada, "Someday 2")
    overdue_old_idea = reminder(old_idea, "Old idea", "2026-11-02", "overdue")

    # Weekly with no date: the schedule starts from today, and the note is not due yet.
    expect { send_change(:patch, "/api/notes/#{someday.id}", { review_interval: "weekly" }) }
      .to send_batch_to(ada, overdue_old_idea)
    expect(response).to have_http_status(:ok)
    expect(json_body["note"]).to include("review_interval" => "weekly", "next_review_date" => "2026-11-16",
                                         "review_state" => nil)

    # Weekly with a past date: the batch sent right after the save holds it as overdue.
    expect do
      send_change(:patch, "/api/notes/#{someday_two.id}", { review_interval: "weekly", next_review_date: "2026-11-02" })
    end.to send_batch_to(ada, overdue_old_idea, reminder(someday_two, "Someday 2", "2026-11-02", "overdue"))
    expect(response).to have_http_status(:ok)
    expect(json_body["note"]).to include("review_interval" => "weekly", "next_review_date" => "2026-11-02",
                                         "review_state" => "overdue")

    # What a check sends: not yet on 2026-11-15, and on 2026-11-16 "Someday" as due today.
    travel_to Time.utc(2026, 11, 15, 20, 0)
    expect(ReviewReminderBatch.for(ada)[:reminders].pluck(:title)).to eq([ "Old idea", "Someday 2" ])
    travel_to Time.utc(2026, 11, 16, 20, 0)
    expect(ReviewReminderBatch.for(ada)[:reminders].last).to eq(reminder(someday, "Someday", "2026-11-16", "due_today"))
    expect(ReviewReminderBatch.for(ada)[:reminders].pluck(:title)).to eq([ "Old idea", "Someday 2", "Someday" ])
  end

  it "AC-19 marking a note with no schedule as reviewed sets its last reviewed date and creates no reminder" do
    sign_in_with_google
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    someday = note_for(ada, "Someday")

    # The batch sent right after the review holds only "Old idea".
    expect { send_change(:post, "/api/notes/#{someday.id}/review") }
      .to send_batch_to(ada, reminder(old_idea, "Old idea", "2026-11-02", "overdue"))
    expect(response).to have_http_status(:ok)
    expect(json_body["note"]).to include("last_reviewed_date" => "2026-11-09")
    expect(review_fields_of(json_body["note"])).to eq(
      "review_interval" => "none", "review_interval_days" => nil, "next_review_date" => nil, "review_state" => nil
    )

    expect(titles_at("/api/notes?review=due_today")).to eq([])
    expect(titles_at("/api/notes?review=overdue")).to eq([ "Old idea" ])
  end

  it "AC-19 setting the interval to none ends a dismissal, so a schedule set again is reminded" do
    sign_in_with_google
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    due_rails_tips = reminder(rails_tips, "Rails tips", "2026-11-09", "due_today")
    # Ada's ack, as feature 23's channel records it, dismisses "Old idea" for 2026-11-02.
    expect(ReviewAck.new(ada, { "note_id" => old_idea.id, "next_review_date" => "2026-11-02" }).record).to be_nil
    expect(ReviewReminderBatch.for(ada)[:reminders]).to eq([ due_rails_tips ])

    expect { send_change(:patch, "/api/notes/#{old_idea.id}", { review_interval: "none" }) }
      .to send_batch_to(ada, due_rails_tips)
    expect(response).to have_http_status(:ok)
    expect(ReviewDismissal.where(note: old_idea)).to be_empty

    # The same date again: no dismissal hides it now.
    expect do
      send_change(:patch, "/api/notes/#{old_idea.id}", { review_interval: "weekly", next_review_date: "2026-11-02" })
    end.to send_batch_to(ada, reminder(old_idea, "Old idea", "2026-11-02", "overdue"), due_rails_tips)
    expect(response).to have_http_status(:ok)
  end
end

require "rails_helper"

# features/20_realtime_notifications. A batch judges the notes on the user's today, as the
# notes API does (spec question 1), and a change made through the API sends the user's new
# batch to each of their open connections at once (spec question 5). A browser signs in
# through the real callback, and a request that changes data sends this session's
# anti-forgery token, as the app does (spec/support/request_helpers.rb). The time is fixed
# at 2026-11-09 20:00 UTC, an hour where the zone changes the date (2026-11-10 in Tokyo).
RSpec.describe "Review reminders", type: :request do
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

  # A note of the user in the named collection, with the given schedule and fields.
  def note_for(user, title, collection: "Work", **fields)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: collection), title: title,
                       body: "Body of #{title}", **fields)
  end

  # A weekly note of the user with the given next review date.
  def weekly(user, title, date, **fields)
    note_for(user, title, review_interval: "weekly", next_review_date: date, **fields)
  end

  # A reminder as a batch holds it (spec question 2).
  def reminder(note_id, title, collection_name, next_review_date, review_state)
    { type: "review_#{review_state}", note_id: note_id, title: title, collection_name: collection_name,
      next_review_date: next_review_date, review_state: review_state }
  end

  # A batch with these reminders, in this order.
  def batch(*reminders)
    { type: "review_reminders", reminders: reminders }
  end

  # The matcher of one batch broadcast to the user's subscriptions, in every tab and browser.
  def send_batch_to(user, expected)
    have_broadcasted_to(user).from_channel(ReviewRemindersChannel).exactly(:once).with(expected)
  end

  # The matcher of no batch at all on the user's subscriptions.
  def send_no_batch_to(user)
    have_broadcasted_to(user).from_channel(ReviewRemindersChannel).exactly(0)
  end

  # A change as the app sends it: a JSON body, with this session's anti-forgery token.
  def send_change(method, path, body = nil)
    send(method, path, params: body, headers: { "X-CSRF-Token" => csrf_token }, as: :json)
  end

  it "AC-20 a batch reads today in the user's saved time zone, and each reminder's review_state is the one the notes API gives" do
    sign_in_with_google
    # The app's session check saves the browser's zone: today is 2026-11-10 in Tokyo.
    get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }
    tokyo_today = weekly(ada, "Tokyo today", "2026-11-10")
    tokyo_yesterday = weekly(ada, "Tokyo yesterday", "2026-11-09")
    weekly(ada, "Tokyo tomorrow", "2026-11-11")

    reminders = ReviewReminderBatch.for(ada)[:reminders]

    expect(reminders.map { |reminder| reminder.values_at(:note_id, :type) }).to eq(
      [ [ tokyo_yesterday.id, "review_overdue" ], [ tokyo_today.id, "review_due_today" ] ]
    )
    get "/api/notes"
    listed_states = json_body["notes"].to_h { |note| [ note["id"], note.fetch("review_state") ] }
    reminders.each do |reminder|
      expect(reminder[:review_state]).to eq(listed_states.fetch(reminder[:note_id]))
    end
  end

  it "AC-20 creating, editing, moving, archiving, restoring, or deleting a note sends the user's new batch at once" do
    sign_in_with_google
    work = ada.collections.create!(name: "Work")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09", collection: "Books")
    path = "/api/notes/#{rails_tips.id}"
    rails_tips_in = ->(title, collection) { reminder(rails_tips.id, title, collection, "2026-11-09", "due_today") }

    # The new note's id is known from the answer, so the first batch matches any id here.
    expect do
      send_change(:post, "/api/notes", { title: "Old idea", body: "B", collection_id: work.id,
                                         review_interval: "weekly", next_review_date: "2026-11-02" })
    end.to send_batch_to(ada, batch(reminder(a_kind_of(Integer), "Old idea", "Work", "2026-11-02", "overdue"),
                                    rails_tips_in.("Rails tips", "Books")))
    expect(response).to have_http_status(:created)
    old_idea = reminder(json_body["note"]["id"], "Old idea", "Work", "2026-11-02", "overdue")

    expect { send_change(:patch, path, { title: "Rails tricks" }) }
      .to send_batch_to(ada, batch(old_idea, rails_tips_in.("Rails tricks", "Books")))
    expect(response).to have_http_status(:ok)

    expect { send_change(:patch, path, { collection_id: work.id }) }
      .to send_batch_to(ada, batch(old_idea, rails_tips_in.("Rails tricks", "Work")))
    expect(response).to have_http_status(:ok)

    expect { send_change(:patch, path, { status: "archived" }) }.to send_batch_to(ada, batch(old_idea))
    expect(response).to have_http_status(:ok)

    expect { send_change(:patch, path, { status: "active" }) }
      .to send_batch_to(ada, batch(old_idea, rails_tips_in.("Rails tricks", "Work")))
    expect(response).to have_http_status(:ok)

    expect { send_change(:delete, path) }.to send_batch_to(ada, batch(old_idea))
    expect(response).to have_http_status(:no_content)
  end

  it "AC-20 marking a note as reviewed sends the user's new batch at once" do
    sign_in_with_google
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09", collection: "Books")

    expect { send_change(:post, "/api/notes/#{rails_tips.id}/review") }
      .to send_batch_to(ada, batch(reminder(old_idea.id, "Old idea", "Work", "2026-11-02", "overdue")))
    # The answer is feature 14's: the next review date counts from today.
    expect(response).to have_http_status(:ok)
    expect(json_body["note"]).to include("next_review_date" => "2026-11-16", "last_reviewed_date" => "2026-11-09")
  end

  it "AC-20 renaming a collection sends the user's new batch with the new name" do
    sign_in_with_google
    old_idea = weekly(ada, "Old idea", "2026-11-02")

    expect { send_change(:patch, "/api/collections/#{old_idea.collection_id}", { name: "Job" }) }
      .to send_batch_to(ada, batch(reminder(old_idea.id, "Old idea", "Job", "2026-11-02", "overdue")))
    expect(response).to have_http_status(:ok)
    expect(json_body).to eq("collection" => { "id" => old_idea.collection_id, "name" => "Job" })
  end

  it "AC-20 AC-22 a refused change sends no batch, and a change sends nothing to another user's connections" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    grace_due = weekly(grace, "Grace due", "2026-11-09")
    sign_in_with_google
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    books = ada.collections.create!(name: "Books")
    stranger = ActionDispatch::Integration::Session.new(Rails.application)
    refused = {
      unprocessable_content: [
        -> { send_change(:post, "/api/notes", { title: "", body: "B", collection_id: books.id }) },
        -> { send_change(:patch, "/api/collections/#{books.id}", { name: "Work" }) }
      ],
      not_found: [
        -> { send_change(:patch, "/api/notes/#{grace_due.id}", { title: "Mine" }) },
        -> { send_change(:post, "/api/notes/#{grace_due.id}/review") },
        -> { send_change(:delete, "/api/notes/#{grace_due.id}") }
      ],
      forbidden: [ -> { patch "/api/notes/#{rails_tips.id}", params: { title: "No token" }, as: :json } ]
    }

    refused.each do |status, changes|
      changes.each do |change|
        expect(&change).to send_no_batch_to(ada).and send_no_batch_to(grace)
        expect(response).to have_http_status(status)
      end
    end
    expect { stranger.patch "/api/notes/#{rails_tips.id}", params: { title: "No sign-in" }, as: :json }
      .to send_no_batch_to(ada).and send_no_batch_to(grace)
    expect(stranger.response).to have_http_status(:unauthorized)

    expect { send_change(:patch, "/api/notes/#{rails_tips.id}", { title: "Rails tricks" }) }
      .to send_batch_to(ada, batch(reminder(rails_tips.id, "Rails tricks", "Work", "2026-11-09", "due_today")))
      .and send_no_batch_to(grace)
    expect(response).to have_http_status(:ok)
  end
end

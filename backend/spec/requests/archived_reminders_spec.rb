require "rails_helper"

# features/18_archived_no_reminders. An archived note gets no review reminder of either kind:
# no review state in the notes API, no place under the "Due today" and "Overdue" filters
# (features 15 to 17), and no reminder in a batch (feature 20) (spec question 1). A browser
# signs in through the real callback, and a request that changes data sends this session's
# anti-forgery token, as the app does (spec/support/request_helpers.rb). The time is fixed at
# 2026-11-09 20:00 UTC; the signed-in user has no saved zone, so "today" is 2026-11-09 (UTC).
RSpec.describe "Archived notes and review reminders", type: :request do
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

  # A weekly note of the user in "Work", with the given next review date and fields.
  def weekly(user, title, date, **fields)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: "Work"), title: title,
                       body: "Body of #{title}", review_interval: "weekly", next_review_date: date, **fields)
  end

  # The titles the list answers for this address.
  def titles_at(path)
    get path
    expect(response).to have_http_status(:ok)
    json_body["notes"].map { |note| note["title"] }
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

  # The review schedule of the note as the API answers it.
  def schedule_of(note_json)
    note_json.slice("review_interval", "review_interval_days", "next_review_date", "last_reviewed_date")
  end

  it "AC-18 the notes API gives archived notes no review state and the review filters leave them out" do
    sign_in_with_google
    old_plan = weekly(ada, "Old plan", "2026-11-02", status: "archived")
    todays_plan = weekly(ada, "Today's plan", "2026-11-09", status: "archived")
    # The control: active notes with the same dates.
    weekly(ada, "Old idea", "2026-11-02")
    weekly(ada, "Rails tips", "2026-11-09")

    get "/api/notes"
    expect(response).to have_http_status(:ok)
    expect(json_body["notes"].to_h { |note| [ note["title"], note.values_at("status", "review_state") ] }).to eq(
      "Old plan" => [ "archived", nil ], "Today's plan" => [ "archived", nil ],
      "Old idea" => [ "active", "overdue" ], "Rails tips" => [ "active", "due_today" ]
    )

    [ old_plan, todays_plan ].each do |note|
      get "/api/notes/#{note.id}"
      expect(response).to have_http_status(:ok)
      expect(json_body["note"]).to include("status" => "archived", "next_review_date" => note.next_review_date.iso8601,
                                           "review_state" => nil)
    end

    expect(titles_at("/api/notes?review=due_today")).to eq([ "Rails tips" ])
    expect(titles_at("/api/notes?review=overdue")).to eq([ "Old idea" ])

    # "Archived" alone lists both, and with "Overdue" or "Due today" nothing.
    expect(titles_at("/api/notes?status=archived")).to contain_exactly("Old plan", "Today's plan")
    %w[overdue due_today].each do |review|
      get "/api/notes?status=archived&review=#{review}"
      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("notes" => [])
    end
  end

  it "AC-18 archiving sends a batch without the note, and restoring sends one with it once it is due" do
    sign_in_with_google
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    later = weekly(ada, "Later", "2026-11-12", status: "archived")
    weekly(ada, "Old plan", "2026-11-02", status: "archived")
    get "/api/notes/#{old_idea.id}"
    schedule_before_archive = schedule_of(json_body["note"])

    # The archive: the batch sent right after it leaves "Old idea" out.
    expect { send_change(:patch, "/api/notes/#{old_idea.id}", { status: "archived" }) }
      .to send_batch_to(ada, reminder(rails_tips, "Rails tips", "2026-11-09", "due_today"))
    expect(response).to have_http_status(:ok)
    expect(json_body["note"]).to include("status" => "archived", "review_state" => nil)
    expect(schedule_of(json_body["note"])).to eq(schedule_before_archive)

    # A change to another note sends a batch, and it leaves every archived note out.
    expect { send_change(:patch, "/api/notes/#{rails_tips.id}", { title: "Rails tricks" }) }
      .to send_batch_to(ada, reminder(rails_tips, "Rails tricks", "2026-11-09", "due_today"))
    expect(response).to have_http_status(:ok)

    # The restore: "Old idea" is overdue again, with the schedule it had, and the batch sent
    # right after the restore holds it.
    expect { send_change(:patch, "/api/notes/#{old_idea.id}", { status: "active" }) }
      .to send_batch_to(ada, reminder(old_idea, "Old idea", "2026-11-02", "overdue"),
                        reminder(rails_tips, "Rails tricks", "2026-11-09", "due_today"))
    expect(response).to have_http_status(:ok)
    expect(json_body["note"]).to include("status" => "active", "review_state" => "overdue")
    expect(schedule_of(json_body["note"])).to eq(schedule_before_archive)

    # "Later" is restored before its date: no batch holds it yet.
    expect { send_change(:patch, "/api/notes/#{later.id}", { status: "active" }) }
      .to send_batch_to(ada, reminder(old_idea, "Old idea", "2026-11-02", "overdue"),
                        reminder(rails_tips, "Rails tricks", "2026-11-09", "due_today"))
    expect(response).to have_http_status(:ok)
    expect(json_body["note"]).to include("status" => "active", "next_review_date" => "2026-11-12", "review_state" => nil)

    # On its date, the batch a check sends holds it as due today.
    travel_to Time.utc(2026, 11, 12, 20, 0)
    expect(ReviewReminderBatch.for(ada)).to eq(
      type: "review_reminders",
      reminders: [ reminder(old_idea, "Old idea", "2026-11-02", "overdue"),
                   reminder(rails_tips, "Rails tricks", "2026-11-09", "overdue"),
                   reminder(later, "Later", "2026-11-12", "due_today") ]
    )
  end

  it "AC-18 an archived note marked as reviewed gets a new date and still no reminder" do
    sign_in_with_google
    old_plan = weekly(ada, "Old plan", "2026-11-02", status: "archived")
    old_idea = weekly(ada, "Old idea", "2026-11-02")

    # The batch sent right after the review holds only the active "Old idea".
    expect { send_change(:post, "/api/notes/#{old_plan.id}/review") }
      .to send_batch_to(ada, reminder(old_idea, "Old idea", "2026-11-02", "overdue"))
    expect(response).to have_http_status(:ok)
    expect(json_body["note"]).to include("status" => "archived", "last_reviewed_date" => "2026-11-09",
                                         "next_review_date" => "2026-11-16", "review_state" => nil)

    expect(titles_at("/api/notes?review=due_today")).to eq([])
    expect(titles_at("/api/notes?review=overdue")).to eq([ "Old idea" ])
  end
end

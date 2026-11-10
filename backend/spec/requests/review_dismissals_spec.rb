require "rails_helper"

# features/23_websocket_client_message. A change of a note's next review date made through the
# API ends its dismissal, so the note is reminded again on its new date (spec question 2), and
# deleting a note deletes its dismissals (spec edge case). Feature 20 sends the user's new
# batch right after each change. A browser signs in through the real callback, and a request
# that changes data sends this session's anti-forgery token, as the app does
# (spec/support/request_helpers.rb). The time is fixed at 2026-11-09 20:00 UTC; a user with
# no saved zone has the today 2026-11-09 (UTC).
RSpec.describe "Review dismissals", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # The user that sign_in_with_google signs in by default.
  def ada
    User.find_by!(provider: "google_oauth2", provider_user_id: "u-1")
  end

  # A note of the user in "Books", with the given interval and next review date.
  def scheduled_note(user, title, interval, date)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: "Books"), title: title,
                       body: "Body of #{title}", review_interval: interval, next_review_date: date)
  end

  # Ada's ack for the note and the date, accepted, as the reminders channel records it.
  def ack(note, date)
    expect(ReviewAck.new(ada, { "note_id" => note.id, "next_review_date" => date }).record).to be_nil
  end

  # A change as the app sends it: a JSON body, with this session's anti-forgery token.
  def send_change(method, path, body = nil)
    send(method, path, params: body, headers: { "X-CSRF-Token" => csrf_token }, as: :json)
  end

  # The reminders of the user's batch at this moment, as [note id, type, date].
  def reminders_of(user)
    ReviewReminderBatch.for(user)[:reminders].map { |reminder| reminder.values_at(:note_id, :type, :next_review_date) }
  end

  it "AC-23 a new date or a review ends the dismissal, and the note is reminded on its new date" do
    sign_in_with_google
    rails_tips = scheduled_note(ada, "Rails tips", "weekly", "2026-11-09")
    ack(rails_tips, "2026-11-09")
    expect(reminders_of(ada)).to eq([])

    # A new date in the edit form: the batch sent right after the save holds the reminder.
    expect { send_change(:patch, "/api/notes/#{rails_tips.id}", { next_review_date: "2026-11-05" }) }
      .to have_broadcasted_to(ada).from_channel(ReviewRemindersChannel).exactly(:once).with(
        type: "review_reminders",
        reminders: [ { type: "review_overdue", note_id: rails_tips.id, title: "Rails tips", collection_name: "Books",
                       next_review_date: "2026-11-05", review_state: "overdue" } ]
      )
    expect(response).to have_http_status(:ok)
    expect(ReviewDismissal.where(note: rails_tips)).to be_empty

    # A review of a daily note moves its date to tomorrow, and the first check after midnight
    # reminds of it as due today.
    daily_tip = scheduled_note(ada, "Daily tip", "daily", "2026-11-09")
    ack(daily_tip, "2026-11-09")
    send_change(:post, "/api/notes/#{daily_tip.id}/review")
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["note"]["next_review_date"]).to eq("2026-11-10")
    expect(ReviewDismissal.where(note: daily_tip)).to be_empty

    travel_to Time.utc(2026, 11, 10, 0, 0, 30)
    expect(reminders_of(ada)).to eq(
      [ [ rails_tips.id, "review_overdue", "2026-11-05" ], [ daily_tip.id, "review_due_today", "2026-11-10" ] ]
    )
  end

  it "AC-23 deleting a note deletes its dismissals" do
    sign_in_with_google
    rails_tips = scheduled_note(ada, "Rails tips", "weekly", "2026-11-09")
    ack(rails_tips, "2026-11-09")
    expect(ReviewDismissal.count).to eq(1)

    send_change(:delete, "/api/notes/#{rails_tips.id}")

    expect(response).to have_http_status(:no_content)
    expect(ReviewDismissal.count).to eq(0)
  end
end

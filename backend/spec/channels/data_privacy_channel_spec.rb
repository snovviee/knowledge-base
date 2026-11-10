require "rails_helper"

# features/21_data_privacy, on the WebSocket. A connection belongs to its browser's sign-in, each
# user receives only their own reminders, and an ack reaches only the user's own notes
# (requirements.md 5). Every behavior checked here was built by features 20, 22, and 23; these
# tests check it across accounts (plan, Deviations).
#
# Me ("Ada Lovelace") signs in through the real Google callback, so my connection can send my
# session cookie. The other user ("Grace Hopper", GitHub) has the notes "Secret plan" (due today)
# and "Secret old" (overdue) in "Secret". The time is fixed at 2026-11-09 20:00 UTC, and neither
# user has a saved zone, so today is 2026-11-09 for both.
#
# The connection class is the one described, so connect builds a connection, and tests names the
# channel that subscribe uses. Action Cable's channel-test stub keeps each transmitted message with
# string keys, so the answers are compared with string keys. A periodic check is run on the
# subscription with instance_exec: no test sleeps. signed_in_browser, session_cookie_of,
# send_session_cookie, and stub_signed_in_connection come from spec/support/cable_helpers.rb;
# workspace_of and no_batch_to from spec/support/privacy_helpers.rb.
RSpec.describe ApplicationCable::Connection, type: :channel do
  include ActiveSupport::Testing::TimeHelpers

  tests ReviewRemindersChannel

  let(:today) { Date.new(2026, 11, 9) }
  let(:my_browser) { signed_in_browser(uid: "u-1", name: "Ada Lovelace") }
  let(:me) { User.find_by!(provider: "google_oauth2", provider_user_id: "u-1") }
  let(:other) { User.create!(provider: "github", provider_user_id: "g-1", display_name: "Grace Hopper") }
  let(:not_found) { { "type" => "error", "error" => "not_found" } }
  let(:invalid) { { "type" => "error", "error" => "invalid" } }

  before do
    travel_to Time.utc(2026, 11, 9, 20, 0)
    my_browser
    work = me.collections.create!(name: "Work")
    books = me.collections.create!(name: "Books")
    note_for(me, "Old idea", books, next_review_date: today - 7)
    note_for(me, "Rails tips", work, next_review_date: today)
    note_for(me, "Later", books, next_review_date: today + 3)

    secret = other.collections.create!(name: "Secret")
    note_for(other, "Secret plan", secret, next_review_date: today)
    note_for(other, "Secret old", secret, next_review_date: today - 3)
  end

  after { travel_back }

  # A weekly note of the user in the collection, with the given next review date.
  def note_for(user, title, collection, next_review_date:)
    user.notes.create!(collection: collection, title: title, body: "Body of #{title}",
                       review_interval: "weekly", next_review_date: next_review_date)
  end

  def note_titled(user, title)
    user.notes.find_by!(title: title)
  end

  # A reminder of the note as a batch holds it (features/20_realtime_notifications question 2).
  def reminder_of(note, state)
    { "type" => "review_#{state}", "note_id" => note.id, "title" => note.title, "collection_name" => note.collection.name,
      "next_review_date" => note.next_review_date.iso8601, "review_state" => state }
  end

  it "AC-21 a connection with no sign-in is refused and a subscription that names another user streams only the connection user's reminders" do
    # No session cookie.
    expect { connect }.to have_rejected_connection

    # My cookie: the connection is mine.
    send_session_cookie(session_cookie_of(my_browser))
    connect
    expect([ connection.current_user, connection.current_sign_in ]).to eq([ me, me.sign_ins.sole ])

    # Its subscription names the other user: the parameter is ignored.
    stub_signed_in_connection(connection.current_sign_in)
    subscribe(user_id: other.id)

    expect(subscription).to be_confirmed
    expect(subscription).to have_stream_for(me)
    expect(subscription).not_to have_stream_for(other)
  end

  it "AC-21 the first batch and every periodic check hold only the connection user's notes" do
    my_batch = { "type" => "review_reminders", "reminders" => [
      reminder_of(note_titled(me, "Old idea"), "overdue"), reminder_of(note_titled(me, "Rails tips"), "due_today")
    ] }
    their_batch = { "type" => "review_reminders", "reminders" => [
      reminder_of(note_titled(other, "Secret old"), "overdue"), reminder_of(note_titled(other, "Secret plan"), "due_today")
    ] }
    check, = ReviewRemindersChannel.periodic_timers.sole
    # My subscription as the app sends it, mine again naming the other user, and theirs: each gets
    # its first batch at once and one more at the check 60 seconds later.
    subscriptions = [
      [ "mine", me.sign_ins.sole, {}, my_batch ],
      [ "mine naming the other user", me.sign_ins.sole, { user_id: other.id }, my_batch ],
      [ "theirs", other.sign_ins.create!, {}, their_batch ]
    ]

    wrong = subscriptions.filter_map do |name, sign_in, params, batch|
      stub_signed_in_connection(sign_in)
      subscribe(params)
      travel 60.seconds
      subscription.instance_exec(&check)
      "#{name}: #{transmissions}" unless transmissions == [ batch, batch ]
    end

    expect(wrong).to be_empty, "expected each subscription to get only its user's batches, but:\n#{wrong.join("\n")}"
  end

  it "AC-21 an ack for another user's note answers not_found like a missing note, records nothing, and leaves their reminders" do
    secret_plan = note_titled(other, "Secret plan")
    rails_tips = note_titled(me, "Rails tips")
    stub_signed_in_connection(me.sign_ins.sole)
    subscribe
    # The first batch is left out, so only the answers count.
    connection.transmissions.clear
    workspaces = [ workspace_of(me), workspace_of(other) ]

    expect {
      # Their note due today, and a missing note: the same answer.
      perform :ack, note_id: secret_plan.id, next_review_date: "2026-11-09"
      perform :ack, note_id: Note.maximum(:id) + 1000, next_review_date: "2026-11-09"
      # A note id that is not a JSON whole number is invalid before any lookup, theirs and mine alike.
      perform :ack, note_id: secret_plan.id.to_s, next_review_date: "2026-11-09"
      perform :ack, note_id: rails_tips.id.to_s, next_review_date: "2026-11-09"
    }.to no_batch_to(me).and no_batch_to(other)

    expect(transmissions).to eq([ not_found, not_found, invalid, invalid ])
    expect(connection.closes).to be_empty
    expect([ workspace_of(me), workspace_of(other) ]).to eq(workspaces)
    expect(ReviewReminderBatch.for(other)[:reminders].pluck(:title)).to eq([ "Secret old", "Secret plan" ])

    # My ack of my own note, naming the other user: the dismissal is mine, and its batch goes on
    # my stream only. An accepted ack answers nothing to the sender.
    expect {
      perform :ack, note_id: rails_tips.id, next_review_date: "2026-11-09", user_id: other.id
    }.to have_broadcasted_to(me).from_channel(ReviewRemindersChannel).exactly(:once).and no_batch_to(other)

    expect(transmissions).to eq([ not_found, not_found, invalid, invalid ])
    expect(ReviewDismissal.sole).to have_attributes(user_id: me.id, note_id: rails_tips.id, next_review_date: today)
    expect(ReviewReminderBatch.for(other)[:reminders].pluck(:title)).to eq([ "Secret old", "Secret plan" ])
    expect(workspace_of(other)).to eq(workspaces.last)
  end
end

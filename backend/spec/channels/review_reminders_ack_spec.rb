require "rails_helper"

# features/23_websocket_client_message. The client sends an ack on the reminders subscription,
# { "action": "ack", "note_id": 7, "next_review_date": "2026-11-09" } (spec question 1). An
# accepted ack records a dismissal for the connection's user, and later batches leave that
# reminder out (question 2). Any other message answers an error to the sender, records
# nothing, and the connection stays open (question 3). The time is fixed at 2026-11-09 20:00
# UTC; a user with no saved zone has the today 2026-11-09 (UTC).
#
# perform calls the channel's perform_action with the action added to the data, as Action
# Cable does for a message command once the connection has decoded its data. It skips the
# connection, whose override has a spec of its own (review_reminders_message_spec.rb). The
# stub connection keeps each transmitted message with string keys, so an answer is compared
# with string keys and a batch with deep_stringify_keys. No test sleeps: a check's batch is
# made by running the channel's periodic callback on the subscription. stub_signed_in_connection
# comes from spec/support/cable_helpers.rb.
RSpec.describe ReviewRemindersChannel, type: :channel do
  include ActiveSupport::Testing::TimeHelpers

  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:invalid) { { "type" => "error", "error" => "invalid" } }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  # A note of the user in the named collection, with the given schedule and fields.
  def note_for(user, title, collection: "Work", **fields)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: collection), title: title,
                       body: "Body of #{title}", **fields)
  end

  # A weekly note of the user with the given next review date.
  def weekly(user, title, date, **fields)
    note_for(user, title, review_interval: "weekly", next_review_date: date, **fields)
  end

  # A subscription of the user's connection. The first batch, sent at once on subscribe
  # (feature 20), is left out of transmissions, so a test sees only what comes after.
  def subscribe_as(user)
    stub_signed_in_connection(user.sign_ins.create!)
    subscribe
    connection.transmissions.clear
  end

  it "AC-23 a message with an action other than ack answers invalid and keeps the connection open" do
    weekly(ada, "Rails tips", "2026-11-09")
    subscribe_as(ada)

    perform :snooze, note_id: 7
    expect(transmissions).to eq([ invalid ])

    # No action at all.
    subscription.perform_action({ "note_id" => 7 })
    # The channel's own perform_action is public, so Action Cable counts it as an action.
    perform :perform_action, note_id: 7
    # Data that is JSON but not an object: null, and a list.
    subscription.perform_action(nil)
    subscription.perform_action([ 1 ])

    expect(transmissions).to eq([ invalid ] * 5)
    expect(connection.closes).to be_empty
    expect(ReviewDismissal.count).to eq(0)
  end

  it "AC-23 an ack whose note_id is not a whole number or whose date is not a real YYYY-MM-DD date answers invalid" do
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    subscribe_as(ada)
    # Action Cable decodes the JSON as it is: 7.0 and 7.5 stay Floats, and "7" text.
    acks = [
      { next_review_date: "2026-11-09" },
      { note_id: rails_tips.id.to_s, next_review_date: "2026-11-09" },
      { note_id: rails_tips.id.to_f, next_review_date: "2026-11-09" },
      { note_id: rails_tips.id + 0.5, next_review_date: "2026-11-09" },
      { note_id: true, next_review_date: "2026-11-09" },
      { note_id: rails_tips.id },
      { note_id: rails_tips.id, next_review_date: "20261109" },
      { note_id: rails_tips.id, next_review_date: "2026-02-30" },
      { note_id: rails_tips.id, next_review_date: "tomorrow" },
      { note_id: rails_tips.id, next_review_date: "" },
      { note_id: rails_tips.id, next_review_date: 20261109 }
    ]

    acks.each { |ack| perform :ack, **ack }

    expect(transmissions).to eq([ invalid ] * acks.size)
    expect(connection.closes).to be_empty
    expect(ReviewDismissal.count).to eq(0)
  end

  it "AC-23 an ack that names no current reminder of the user answers not_found and records nothing" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    grace_due = weekly(grace, "Grace due", "2026-11-09")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    deleted = weekly(ada, "Deleted tip", "2026-11-09")
    deleted.destroy!
    archived = weekly(ada, "Old plan", "2026-11-02", status: "archived")
    unscheduled = note_for(ada, "No schedule")
    later = weekly(ada, "Later", "2026-11-12")
    subscribe_as(ada)
    acks = [
      { note_id: grace_due.id, next_review_date: "2026-11-09" },
      { note_id: deleted.id, next_review_date: "2026-11-09" },
      { note_id: 999_999, next_review_date: "2026-11-09" },
      { note_id: archived.id, next_review_date: "2026-11-02" },
      { note_id: unscheduled.id, next_review_date: "2026-11-09" },
      { note_id: later.id, next_review_date: "2026-11-12" },
      # A date that is not the note's next review date.
      { note_id: rails_tips.id, next_review_date: "2026-11-08" }
    ]

    acks.each { |ack| perform :ack, **ack }

    expect(transmissions).to eq([ { "type" => "error", "error" => "not_found" } ] * acks.size)
    expect(connection.closes).to be_empty
    expect(ReviewDismissal.count).to eq(0)
  end

  it "AC-23 an ack is checked for invalid before not_found" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    grace_due = weekly(grace, "Grace due", "2026-11-09")
    subscribe_as(ada)

    # Grace's due note, named by its id as text, and with a date that does not exist.
    perform :ack, note_id: grace_due.id.to_s, next_review_date: "2026-11-09"
    perform :ack, note_id: grace_due.id, next_review_date: "2026-02-30"

    expect(transmissions).to eq([ invalid, invalid ])
    expect(ReviewDismissal.count).to eq(0)
  end

  it "AC-23 an ack for a current reminder records the dismissal, and later batches leave the reminder out" do
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09", collection: "Books")
    # A dismissal of "Old idea" for a date it does not have, as a direct database write could
    # leave behind: it does not hide the reminder of the note's own date.
    ReviewDismissal.create!(user: ada, note: old_idea, next_review_date: Date.new(2026, 11, 1))
    sign_in = ada.sign_ins.create!
    stub_signed_in_connection(sign_in)
    subscribe
    connection.transmissions.clear

    perform :ack, note_id: rails_tips.id, next_review_date: "2026-11-09"

    expect(transmissions).to eq([])
    expect(ReviewDismissal.where(note: rails_tips).pluck(:user_id, :next_review_date)).to eq(
      [ [ ada.id, Date.new(2026, 11, 9) ] ]
    )

    # The next check's batch, while "Rails tips" is still due today.
    check, = described_class.periodic_timers.sole
    travel 60.seconds
    subscription.instance_exec(&check)
    expect(rails_tips.reload.review_state(ada.today)).to eq("due_today")
    expect(transmissions.sole["reminders"].pluck("note_id")).to eq([ old_idea.id ])

    # A reload: a new connection of the same sign-in, and its first batch.
    stub_signed_in_connection(sign_in)
    subscribe
    expect(transmissions.sole["reminders"].pluck("note_id")).to eq([ old_idea.id ])

    # A time zone that another browser saved after this connection opened counts for an ack,
    # as for the batches (feature 20): today is 2026-11-10 in Tokyo.
    tokyo_today = weekly(ada, "Tokyo today", "2026-11-10")
    User.find(ada.id).update!(time_zone: "Asia/Tokyo")
    connection.transmissions.clear
    perform :ack, note_id: tokyo_today.id, next_review_date: "2026-11-10"
    expect(transmissions).to eq([])
    expect(ReviewDismissal.where(note: tokyo_today).count).to eq(1)
  end

  it "AC-23 an accepted ack sends a new batch to every connection of the user at once" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    weekly(grace, "Grace due", "2026-11-09")
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09", collection: "Books")
    subscribe_as(ada)
    # The user's stream reaches each of their subscriptions, in every tab and browser.
    batch_to = ->(user) { have_broadcasted_to(user).from_channel(described_class) }

    expect { perform :ack, note_id: rails_tips.id, next_review_date: "2026-11-09" }
      .to batch_to.(ada).exactly(:once).with(
        type: "review_reminders",
        reminders: [ { type: "review_overdue", note_id: old_idea.id, title: "Old idea", collection_name: "Work",
                       next_review_date: "2026-11-02", review_state: "overdue" } ]
      ).and batch_to.(grace).exactly(0)
    expect(transmissions).to eq([])

    # An ack answered with an error changed nothing, and sends no batch.
    expect { perform :ack, note_id: rails_tips.id, next_review_date: "2026-11-08" }.to batch_to.(ada).exactly(0)
    expect { perform :ack, note_id: rails_tips.id.to_s, next_review_date: "2026-11-09" }.to batch_to.(ada).exactly(0)
    expect(transmissions).to eq([ { "type" => "error", "error" => "not_found" }, invalid ])
  end

  it "AC-23 the same ack twice is accepted and records one dismissal" do
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    subscribe_as(ada)

    # The second ack could come from a second tab at the same moment.
    2.times { perform :ack, note_id: rails_tips.id, next_review_date: "2026-11-09" }

    expect(transmissions).to eq([])
    expect(ReviewDismissal.where(note: rails_tips).pluck(:user_id, :next_review_date)).to eq(
      [ [ ada.id, Date.new(2026, 11, 9) ] ]
    )
  end

  it "AC-23 a dismissal lasts past midnight while the date is the same, and an ack handled just after midnight is accepted" do
    # Ada has no saved zone, so her midnight is midnight UTC.
    travel_to Time.utc(2026, 11, 9, 23, 59, 30)
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    old_soon = weekly(ada, "Old soon", "2026-11-09")
    subscribe_as(ada)
    perform :ack, note_id: rails_tips.id, next_review_date: "2026-11-09"
    check, = described_class.periodic_timers.sole

    travel_to Time.utc(2026, 11, 10, 0, 0, 30)
    subscription.instance_exec(&check)

    # "Rails tips" is overdue now, with the same date, and still left out.
    expect(rails_tips.reload.review_state(ada.today)).to eq("overdue")
    expect(transmissions.sole["reminders"].map { |reminder| reminder.values_at("note_id", "type") }).to eq(
      [ [ old_soon.id, "review_overdue" ] ]
    )

    # The ack for "Old soon", sent before midnight, when it was due today, and handled now:
    # it is still a current reminder, now overdue.
    connection.transmissions.clear
    perform :ack, note_id: old_soon.id, next_review_date: "2026-11-09"
    expect(transmissions).to eq([])
    expect(ReviewDismissal.where(note: old_soon).count).to eq(1)
  end

  it "AC-23 an ack takes its user only from the connection and ignores a user_id in the message" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    grace_due = weekly(grace, "Grace due", "2026-11-09")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    subscribe_as(ada)

    perform :ack, note_id: grace_due.id, next_review_date: "2026-11-09", user_id: grace.id

    expect(transmissions).to eq([ { "type" => "error", "error" => "not_found" } ])
    expect(ReviewDismissal.where(note: grace_due)).to be_empty
    expect(ReviewReminderBatch.for(grace)[:reminders].pluck(:note_id)).to eq([ grace_due.id ])

    perform :ack, note_id: rails_tips.id, next_review_date: "2026-11-09", user_id: grace.id

    expect(transmissions.size).to eq(1)
    expect(ReviewDismissal.where(note: rails_tips).pluck(:user_id)).to eq([ ada.id ])
  end
end

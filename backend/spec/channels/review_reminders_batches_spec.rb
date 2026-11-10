require "rails_helper"

# features/20_realtime_notifications. The reminders subscription receives the user's batch at
# once, then again at every 60-second check, and right after a change (spec questions 1 to 5).
# The time is fixed at 2026-11-09 20:00 UTC; a user with no saved zone has the today
# 2026-11-09 (UTC).
#
# Action Cable's channel-test stub keeps each transmitted message with string keys, so the
# batches are compared with deep_stringify_keys. It starts no timers: a test runs the
# periodic callback itself, on the subscription, with instance_exec. No test sleeps.
# stub_signed_in_connection comes from spec/support/cable_helpers.rb.
RSpec.describe ReviewRemindersChannel, type: :channel do
  include ActiveSupport::Testing::TimeHelpers

  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }

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

  # The user's batch at this moment, as a subscriber receives it.
  def batch_of(user)
    ReviewReminderBatch.for(user).deep_stringify_keys
  end

  it "AC-20 subscribing to the reminders streams for the connection's user and sends the first batch at once" do
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09", collection: "Books")
    weekly(ada, "Later", "2026-11-12", collection: "Books")
    stub_signed_in_connection(ada.sign_ins.create!)

    subscribe

    expect(subscription).to be_confirmed
    expect(subscription).to have_stream_for(ada)
    expect(transmissions).to eq([ batch_of(ada) ])
    expect(transmissions.sole["reminders"].pluck("note_id")).to eq([ old_idea.id, rails_tips.id ])
  end

  it "AC-20 AC-22 a batch holds only the connection user's notes, whatever the subscription's parameters" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    weekly(grace, "Grace due", "2026-11-09")
    stub_signed_in_connection(ada.sign_ins.create!)

    subscribe(user_id: grace.id)

    expect(subscription).to have_stream_for(ada)
    expect(subscription).not_to have_stream_for(grace)
    expect(transmissions).to eq([ batch_of(ada) ])
    expect(transmissions.sole["reminders"].pluck("note_id")).to eq([ rails_tips.id ])
  end

  it "AC-20 the channel checks again every 60 seconds and sends a batch each time, the same when nothing changed" do
    weekly(ada, "Old idea", "2026-11-02")
    weekly(ada, "Rails tips", "2026-11-09", collection: "Books")
    stub_signed_in_connection(ada.sign_ins.create!)
    subscribe

    check, options = described_class.periodic_timers.sole
    expect(options).to eq(every: 60.seconds)
    travel 60.seconds
    subscription.instance_exec(&check)
    travel 60.seconds
    subscription.instance_exec(&check)

    expect(transmissions).to eq([ batch_of(ada) ] * 3)
    expect(transmissions.first["reminders"].size).to eq(2)
  end

  it "AC-20 the first check after midnight in the user's zone turns due today into overdue and the new day's note into due today" do
    # Ada has no saved zone, so her midnight is midnight UTC.
    travel_to Time.utc(2026, 11, 9, 23, 59, 30)
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    later = weekly(ada, "Later", "2026-11-10")
    stub_signed_in_connection(ada.sign_ins.create!)
    subscribe
    check, = described_class.periodic_timers.sole

    travel_to Time.utc(2026, 11, 10, 0, 0, 30)
    subscription.instance_exec(&check)

    before_midnight, after_midnight = transmissions.map do |batch|
      batch["reminders"].map { |reminder| reminder.values_at("note_id", "type", "review_state") }
    end
    expect(before_midnight).to eq([ [ rails_tips.id, "review_due_today", "due_today" ] ])
    expect(after_midnight).to eq(
      [ [ rails_tips.id, "review_overdue", "overdue" ], [ later.id, "review_due_today", "due_today" ] ]
    )
  end

  it "AC-20 a time zone saved by another browser applies from the next batch" do
    tokyo_today = weekly(ada, "Tokyo today", "2026-11-10")
    stub_signed_in_connection(ada.sign_ins.create!)
    subscribe
    expect(transmissions.sole["reminders"]).to eq([])

    # Another browser's session check saves its zone: today is 2026-11-10 in Tokyo. The
    # connection's user was loaded before that.
    User.find(ada.id).update!(time_zone: "Asia/Tokyo")
    check, = described_class.periodic_timers.sole
    travel 60.seconds
    subscription.instance_exec(&check)

    expect(transmissions.last["reminders"].map { |reminder| reminder.values_at("note_id", "type") }).to eq(
      [ [ tokyo_today.id, "review_due_today" ] ]
    )
  end

  it "AC-20 AC-22 no batch goes out once the connection's sign-in is gone" do
    weekly(ada, "Rails tips", "2026-11-09")
    sign_in = ada.sign_ins.create!
    stub_signed_in_connection(sign_in)
    subscribe
    expect(transmissions.size).to eq(1)

    # The sign-in is deleted on the server, and nothing has closed this connection yet.
    sign_in.delete
    check, = described_class.periodic_timers.sole
    travel 60.seconds
    subscription.instance_exec(&check)

    expect(transmissions.size).to eq(1)
    expect(connection.closes).to eq([ { reason: "unauthorized", reconnect: false } ])
  end

  it "AC-20 send_batch_to broadcasts the user's current batch to that user's subscriptions only" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09", collection: "Books")
    weekly(grace, "Grace due", "2026-11-09")

    expect { described_class.send_batch_to(ada) }.to have_broadcasted_to(ada).from_channel(described_class).with(
      type: "review_reminders",
      reminders: [
        { type: "review_overdue", note_id: old_idea.id, title: "Old idea", collection_name: "Work",
          next_review_date: "2026-11-02", review_state: "overdue" },
        { type: "review_due_today", note_id: rails_tips.id, title: "Rails tips", collection_name: "Books",
          next_review_date: "2026-11-09", review_state: "due_today" }
      ]
    ).exactly(:once)
    expect { described_class.send_batch_to(ada) }.not_to have_broadcasted_to(grace).from_channel(described_class)
  end
end

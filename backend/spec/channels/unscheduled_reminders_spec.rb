require "rails_helper"

# features/19_unscheduled_no_reminders. No batch holds a note with the interval none: not the
# first one of a subscription, not a check's, and not the first check after midnight (spec
# question 1; feature 20 questions 1 and 4). An ack for such a note answers not_found and
# records nothing (feature 23 question 3). A user with no saved zone has the today of UTC, so
# their midnight is midnight UTC.
#
# The app never gives a note with the interval none a next review date (feature 12), so some
# rows here get one straight in the database, with update_columns, which skips the model's
# rules: the interval, not a missing date, must keep them out.
#
# Action Cable's channel-test stub keeps each transmitted message with string keys, and it
# starts no timers: a test runs the periodic callback itself, on the subscription, with
# instance_exec. No test sleeps. stub_signed_in_connection comes from
# spec/support/cable_helpers.rb.
RSpec.describe ReviewRemindersChannel, type: :channel do
  include ActiveSupport::Testing::TimeHelpers

  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:grace) { User.create!(provider: "github", provider_user_id: "42", display_name: "Grace") }

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

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

  # A note with the interval none whose row holds this next review date anyway.
  def stray(user, title, date, **fields)
    note_for(user, title, **fields).tap { |note| note.update_columns(next_review_date: date) }
  end

  # Each batch this connection received, as the [title, type] of its reminders.
  def batches_received
    transmissions.map { |batch| batch["reminders"].map { |reminder| reminder.values_at("title", "type") } }
  end

  it "AC-19 no batch holds a note with no review schedule, the first one, a check's, and the first check after midnight included" do
    # The checks run every 60 seconds: one before midnight, at 23:59:30, and the first one
    # after it, at 00:00:30.
    travel_to Time.utc(2026, 11, 9, 23, 58, 30)
    note_for(ada, "Someday")
    note_for(ada, "Old someday", status: "archived")
    stray(ada, "Stray past", "2026-11-02")
    stray(ada, "Stray tomorrow", "2026-11-10")
    # The control: active weekly notes, one overdue and one due from midnight on.
    weekly(ada, "Old idea", "2026-11-02")
    weekly(ada, "Tomorrow tip", "2026-11-10")
    stray(grace, "Grace someday", "2026-11-09")
    weekly(grace, "Grace due", "2026-11-09")

    stub_signed_in_connection(ada.sign_ins.create!)
    subscribe
    check, = described_class.periodic_timers.sole
    travel 60.seconds
    subscription.instance_exec(&check)
    travel 60.seconds
    expect(Time.current).to eq(Time.utc(2026, 11, 10, 0, 0, 30))
    subscription.instance_exec(&check)

    before_midnight = [ [ "Old idea", "review_overdue" ] ]
    expect(batches_received).to eq(
      [ before_midnight, before_midnight, [ [ "Old idea", "review_overdue" ], [ "Tomorrow tip", "review_due_today" ] ] ]
    )

    # Grace's own first batch, after midnight: her note with no schedule is not in it either.
    stub_signed_in_connection(grace.sign_ins.create!)
    subscribe
    expect(batches_received).to eq([ [ [ "Grace due", "review_overdue" ] ] ])
  end

  it "AC-19 an ack for a note with no review schedule answers not_found and records nothing" do
    someday = note_for(ada, "Someday")
    stray_today = stray(ada, "Stray today", "2026-11-09")
    rails_tips = weekly(ada, "Rails tips", "2026-11-09")
    stub_signed_in_connection(ada.sign_ins.create!)
    subscribe
    # The first batch, sent on subscribe (feature 20), is left out.
    connection.transmissions.clear

    perform :ack, note_id: someday.id, next_review_date: "2026-11-09"
    perform :ack, note_id: stray_today.id, next_review_date: "2026-11-09"

    expect(transmissions).to eq([ { "type" => "error", "error" => "not_found" } ] * 2)
    expect(connection.closes).to be_empty
    expect(ReviewDismissal.count).to eq(0)

    # The control: an ack for a current reminder is accepted, with no answer to the sender.
    perform :ack, note_id: rails_tips.id, next_review_date: "2026-11-09"
    expect(transmissions.size).to eq(2)
    expect(ReviewDismissal.pluck(:note_id)).to eq([ rails_tips.id ])
  end
end

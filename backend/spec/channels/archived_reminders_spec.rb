require "rails_helper"

# features/18_archived_no_reminders. No batch holds an archived note: not the first one of a
# subscription, not a check's, and not the first check after midnight (spec question 1;
# feature 20 questions 1 and 4). A user with no saved zone has the today of UTC, so their
# midnight is midnight UTC.
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

  # A weekly note of the user in "Work", with the given next review date and fields.
  def weekly(user, title, date, **fields)
    user.notes.create!(collection: user.collections.find_or_create_by!(name: "Work"), title: title,
                       body: "Body of #{title}", review_interval: "weekly", next_review_date: date, **fields)
  end

  # Each batch this connection received, as the [title, type] of its reminders.
  def batches_received
    transmissions.map { |batch| batch["reminders"].map { |reminder| reminder.values_at("title", "type") } }
  end

  it "AC-18 no batch holds an archived note, the first one, a check's, and the first check after midnight included" do
    # The checks run every 60 seconds: one before midnight, at 23:59:30, and the first one
    # after it, at 00:00:30.
    travel_to Time.utc(2026, 11, 9, 23, 58, 30)
    weekly(ada, "Old plan", "2026-11-02", status: "archived")
    weekly(ada, "Today's plan", "2026-11-09", status: "archived")
    weekly(ada, "Tomorrow's plan", "2026-11-10", status: "archived")
    # The control: active notes with the same dates.
    weekly(ada, "Old idea", "2026-11-02")
    weekly(ada, "Rails tips", "2026-11-09")
    weekly(ada, "Tomorrow's idea", "2026-11-10")
    weekly(grace, "Grace's plan", "2026-11-09", status: "archived")
    weekly(grace, "Grace due", "2026-11-09")

    stub_signed_in_connection(ada.sign_ins.create!)
    subscribe
    check, = described_class.periodic_timers.sole
    travel 60.seconds
    subscription.instance_exec(&check)
    travel 60.seconds
    expect(Time.current).to eq(Time.utc(2026, 11, 10, 0, 0, 30))
    subscription.instance_exec(&check)

    before_midnight = [ [ "Old idea", "review_overdue" ], [ "Rails tips", "review_due_today" ] ]
    expect(batches_received).to eq(
      [ before_midnight, before_midnight,
        [ [ "Old idea", "review_overdue" ], [ "Rails tips", "review_overdue" ], [ "Tomorrow's idea", "review_due_today" ] ] ]
    )

    # Grace's own first batch, after midnight: her archived note is not in it either.
    stub_signed_in_connection(grace.sign_ins.create!)
    subscribe
    expect(batches_received).to eq([ [ [ "Grace due", "review_overdue" ] ] ])
  end

  it "AC-18 a dismissed reminder stays dismissed through an archive and a restore" do
    old_idea = weekly(ada, "Old idea", "2026-11-02")
    weekly(ada, "Rails tips", "2026-11-09")
    stub_signed_in_connection(ada.sign_ins.create!)
    subscribe
    expect(batches_received).to eq([ [ [ "Old idea", "review_overdue" ], [ "Rails tips", "review_due_today" ] ] ])

    # The ack of feature 23 dismisses the reminder of "Old idea" for 2026-11-02.
    perform :ack, note_id: old_idea.id, next_review_date: "2026-11-02"
    expect(ReviewDismissal.where(note: old_idea).pluck(:next_review_date)).to eq([ Date.new(2026, 11, 2) ])

    # An archive and a restore, as the API's edit makes them: only the status changes.
    old_idea.update!(status: "archived")
    old_idea.update!(status: "active")
    expect(old_idea.reload.review_state(ada.today)).to eq("overdue")

    connection.transmissions.clear
    check, = described_class.periodic_timers.sole
    travel 60.seconds
    subscription.instance_exec(&check)

    expect(batches_received).to eq([ [ [ "Rails tips", "review_due_today" ] ] ])
    expect(ReviewDismissal.where(note: old_idea).pluck(:user_id, :next_review_date)).to eq(
      [ [ ada.id, Date.new(2026, 11, 2) ] ]
    )
  end
end

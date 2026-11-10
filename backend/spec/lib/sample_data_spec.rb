require "rails_helper"

# features/26_local_run. Sample data for a developer's workspace (spec questions 5 to 12):
# `bin/rails sample_data:load` adds it to the workspace of the newest sign-in's user,
# in the development and test environments only.
RSpec.describe "Sample data" do
  include ActiveSupport::Testing::TimeHelpers

  after { travel_back }

  # The number of each kind of record, to show that nothing was added.
  def record_counts
    [ User.count, Collection.count, Tag.count, Note.count, NoteTag.count ]
  end

  # A user's numbers of collections, tags, and notes.
  def workspace(user)
    [ user.collections.count, user.tags.count, user.notes.count ]
  end

  # A user with a sign-in that logout has not ended, as the sign-in callback leaves it.
  def signed_in(name, provider: "google_oauth2", uid: name.parameterize)
    user = User.create!(provider: provider, provider_user_id: uid, display_name: name)
    user.sign_ins.create!
    user
  end

  # Expects SampleData.load! to be refused with the message, and to add nothing.
  def expect_refusal(message)
    before = record_counts
    expect { SampleData.load! }.to raise_error(SampleData::Refused, message)
    expect(record_counts).to eq(before)
  end

  it "AC-26 preparing a new database adds no sample data" do
    # db:prepare runs db/seeds.rb when it creates a database, before anyone has signed
    # in (spec question 6).
    expect { Rails.application.load_seed }.not_to change { record_counts }
  end

  it "AC-26 sample data is refused outside development and test" do
    # A signed-in user with an empty workspace, who would get the data in development.
    signed_in("Ada Lovelace")
    allow(Rails).to receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new("production"))

    expect_refusal("Sample data is for the development and test environments only.")
  end

  it "AC-26 sample data is refused when no one is signed in" do
    # No user at all.
    expect_refusal("No one is signed in. Sign in with Google or GitHub, then run this again.")

    # A user whose only sign-in logout ended: logout deletes it (features/05_logout).
    ada = signed_in("Ada Lovelace")
    ada.sign_ins.destroy_all

    expect_refusal("No one is signed in. Sign in with Google or GitHub, then run this again.")
  end

  it "AC-26 sample data goes only into the workspace of the newest sign-in's user" do
    ada = signed_in("Ada Lovelace")
    travel 1.minute
    grace = signed_in("Grace Hopper", provider: "github")

    SampleData.load!

    expect(workspace(grace)).to all(be_positive)
    expect(workspace(ada)).to eq([ 0, 0, 0 ])

    # Grace logs out, which deletes her sign-in (features/05_logout): Ada's is the newest.
    grace.sign_ins.destroy_all
    grace_before = workspace(grace)

    SampleData.load!

    expect(workspace(ada)).to all(be_positive)
    expect(workspace(grace)).to eq(grace_before)

    # A sign-in whose cookie expired long ago (30 days after the last request) without a
    # logout keeps its record, so it still counts (spec edge case).
    SignIn.delete_all
    charles = User.create!(provider: "google_oauth2", provider_user_id: "c-1", display_name: "Charles Babbage")
    charles.sign_ins.create!(created_at: 40.days.ago, updated_at: 40.days.ago)

    SampleData.load!

    expect(workspace(charles)).to all(be_positive)
  end

  it "AC-26 sample data is refused for a workspace that has a collection, a tag, or a note" do
    ada = signed_in("Ada Lovelace")
    ada_has_data = "Ada Lovelace (Google) already has collections, tags, or notes, so no sample data was added. " \
                   "To start over, see \"Sample data\" in the README."

    # One collection, and nothing else.
    inbox = ada.collections.create!(name: "Inbox")
    expect_refusal(ada_has_data)
    inbox.destroy!

    # One tag, and nothing else.
    tag = ada.tags.create!(name: "later")
    expect_refusal(ada_has_data)
    tag.destroy!

    # One note, and nothing else. A note always has one of its user's collections, so
    # its row is written directly, in another user's collection, to test the note alone.
    other = User.create!(provider: "github", provider_user_id: "o-1", display_name: "Other")
    now = Time.current
    Note.insert!({ user_id: ada.id, collection_id: other.collections.create!(name: "Theirs").id,
                   title: "A note", body: "B", created_at: now, updated_at: now })
    expect(workspace(ada)).to eq([ 0, 0, 1 ])
    expect_refusal(ada_has_data)
    Note.where(user: ada).delete_all

    # A GitHub user, after a load that added the data: a second load is refused.
    travel 1.minute
    grace = signed_in("Grace Hopper", provider: "github")
    SampleData.load!
    expect_refusal("Grace Hopper (GitHub) already has collections, tags, or notes, so no sample data was added. " \
                   "To start over, see \"Sample data\" in the README.")

    # A saved time zone and two sign-ins are not data (spec edge case).
    travel 1.minute
    charles = signed_in("Charles Babbage")
    charles.update!(time_zone: "Europe/London")
    charles.sign_ins.create!

    SampleData.load!

    expect(workspace(charles)).to all(be_positive)
  end

  it "AC-26 the sample data has three collections, four tags, and ten notes that cover every case" do
    ada = signed_in("Ada Lovelace")

    SampleData.load!

    collections = ada.collections.to_a
    expect(collections.size).to eq(3)
    expect(collections.count { |collection| ada.notes.where(collection: collection).none? }).to eq(1)

    tags = ada.tags.to_a
    expect(tags.size).to eq(4)
    expect(tags.count { |tag| tag.notes.none? }).to eq(1)

    # The notes in the order the list shows them, newest first (features/09_notes_crud).
    notes = ada.notes.newest_first.includes(:tags).to_a
    expect(notes.map(&:title)).to eq([
      "Active Record callbacks", "RSpec: let and let!", "Weekly review checklist", "Spaced repetition",
      "The testing pyramid", "Deep Work: notes on focus", "SQLite in production", "Side project ideas",
      "Hotwire notes", "Books to read next"
    ])
    expect(notes.map { |note| note.tags.size }).to include(0, 1, 2)
    expect(notes.map(&:status)).to include("active", "archived")
    expect(notes.map(&:source_url).compact).not_to be_empty
    expect(notes.map(&:review_interval).uniq).to match_array(%w[none daily weekly monthly custom])
    expect(notes.select { |note| note.review_interval == "custom" }.map(&:review_interval_days)).to all(be_between(1, 365))
  end

  it "AC-26 the sample data's review dates count from the user's today" do
    # 2026-11-09 20:00 UTC is 2026-11-10 in Tokyo, so T is 2026-11-10 for this user, and
    # every date would be a day earlier in UTC.
    travel_to Time.utc(2026, 11, 9, 20, 0)
    ada = signed_in("Ada Lovelace")
    ada.update!(time_zone: "Asia/Tokyo")

    SampleData.load!

    # Each note's next review date and last reviewed date, or nil for none.
    dates = ada.notes.to_h { |note| [ note.title, [ note.next_review_date&.iso8601, note.last_reviewed_date&.iso8601 ] ] }
    expect(dates).to eq(
      "Active Record callbacks" => [ "2026-11-07", "2026-10-31" ],
      "RSpec: let and let!" => [ "2026-11-10", "2026-11-09" ],
      "Weekly review checklist" => [ "2026-11-10", "2026-11-03" ],
      "Spaced repetition" => [ "2026-11-12", "2026-11-09" ],
      "The testing pyramid" => [ "2026-11-15", "2026-11-08" ],
      "Deep Work: notes on focus" => [ "2026-11-30", nil ],
      "SQLite in production" => [ "2026-11-22", "2026-11-08" ],
      "Side project ideas" => [ nil, nil ],
      "Hotwire notes" => [ "2026-10-27", "2026-10-20" ],
      "Books to read next" => [ nil, nil ]
    )
  end

  it "AC-26 the sample data is added all at once, or not at all" do
    signed_in("Ada Lovelace")
    # One more note, with a blank title, which the note's rules refuse. It is first in
    # the list, so it is created last: after the collections, the tags, and the other notes.
    broken = SampleData::NOTES.last.merge(title: " ")
    stub_const("SampleData::NOTES", [ broken, *SampleData::NOTES ])
    before = record_counts

    expect { SampleData.load! }.to raise_error(ActiveRecord::RecordInvalid)
    expect(record_counts).to eq(before)
  end
end

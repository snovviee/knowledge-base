require "rails_helper"

# features/17_search_and_filter. GET /api/notes takes the filters collection_id, tag_id, status,
# and review, each optional, and all of them combine with the search (spec questions 1, 2, 7
# to 9, 12, and 18). A browser signs in through the real callback
# (spec/support/request_helpers.rb). The time is fixed at 2026-11-09 20:00 UTC, an hour where
# the zone changes the date (2026-11-10 in Tokyo). The signed-in user has no saved zone unless
# a test gives one, so "today" is 2026-11-09 (UTC).
RSpec.describe "Note filters", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  before { travel_to Time.utc(2026, 11, 9, 20, 0) }
  after { travel_back }

  def json_body
    JSON.parse(response.body)
  end

  # The user that sign_in_with_google signs in by default.
  def ada
    User.find_by!(provider: "google_oauth2", provider_user_id: "u-1")
  end

  # Another user, who signs in with GitHub.
  def grace
    User.find_or_create_by!(provider: "github", provider_user_id: "42") { |user| user.display_name = "Grace" }
  end

  # A note of the user, in their "Work" collection unless the fields name another one.
  def note_for(user, title, **fields)
    work = user.collections.find_or_create_by!(name: "Work")
    user.notes.create!(collection: work, title: title, body: "Body of #{title}", **fields)
  end

  # A weekly note of the user with the given next review date.
  def weekly(user, title, date, **fields)
    note_for(user, title, review_interval: "weekly", next_review_date: date, **fields)
  end

  # The titles that GET /api/notes answers for the query, in the answer's order. The answer
  # must be 200.
  def titles_listed(query)
    get "/api/notes?#{query}"
    expect(response).to have_http_status(:ok)
    json_body["notes"].map { |note| note["title"] }
  end

  it "AC-17 collection_id lists the notes of that collection, and one that is not the user's lists none" do
    sign_in_with_google
    work = ada.collections.create!(name: "Work")
    books = ada.collections.create!(name: "Books")
    note_for(ada, "Cooking", collection: work, created_at: 3.minutes.ago)
    note_for(ada, "Book list", collection: books, created_at: 2.minutes.ago)
    note_for(ada, "Rails tips", collection: work, created_at: 1.minute.ago)
    secret = grace.collections.create!(name: "Secret")
    note_for(grace, "Secret rails", collection: secret)
    deleted = ada.collections.create!(name: "Old")
    deleted.destroy!

    expect(titles_listed("collection_id=#{work.id}")).to eq([ "Rails tips", "Cooking" ])

    # Another user's collection, a deleted one, an id that no collection has, and values
    # that are not whole numbers: the same answer.
    [ secret.id, deleted.id, "99999999999999999999", "abc", "1.5" ].each do |value|
      expect(titles_listed("collection_id=#{value}")).to eq([])
    end
  end

  it "AC-17 tag_id lists the notes with that tag, and one that is not the user's lists none" do
    sign_in_with_google
    ruby = ada.tags.create!(name: "ruby")
    ai = ada.tags.create!(name: "ai")
    note_for(ada, "Old idea", tags: [ ruby ], created_at: 4.minutes.ago)
    note_for(ada, "Book list", created_at: 3.minutes.ago)
    note_for(ada, "Neural nets", tags: [ ai ], created_at: 2.minutes.ago)
    note_for(ada, "Rails tips", tags: [ ai, ruby ], created_at: 1.minute.ago)
    private_tag = grace.tags.create!(name: "private")
    note_for(grace, "Secret rails", tags: [ private_tag ])
    # A deleted tag: its links go with it, and its notes stay.
    deleted = ada.tags.create!(name: "old")
    note_for(ada, "Once old", tags: [ deleted ])
    deleted.destroy!

    expect(titles_listed("tag_id=#{ruby.id}")).to eq([ "Rails tips", "Old idea" ])

    [ private_tag.id, deleted.id, "abc", "1.5" ].each do |value|
      expect(titles_listed("tag_id=#{value}")).to eq([])
    end
  end

  it "AC-17 status lists only the active or only the archived notes" do
    sign_in_with_google
    note_for(ada, "Old idea", status: "archived", created_at: 3.minutes.ago)
    note_for(ada, "Cooking", created_at: 2.minutes.ago)
    note_for(ada, "Rails tips", created_at: 1.minute.ago)
    note_for(grace, "Grace archived", status: "archived")

    expect(titles_listed("status=archived")).to eq([ "Old idea" ])
    expect(titles_listed("status=active")).to eq([ "Rails tips", "Cooking" ])
  end

  it "AC-17 review=next_7_days lists the active scheduled notes due from tomorrow through today plus 7 days" do
    sign_in_with_google
    weekly(ada, "Due now", "2026-11-09", created_at: 7.minutes.ago)
    weekly(ada, "Tomorrow", "2026-11-10", created_at: 6.minutes.ago)
    weekly(ada, "In a week", "2026-11-16", created_at: 5.minutes.ago)
    weekly(ada, "In 8 days", "2026-11-17", created_at: 4.minutes.ago)
    weekly(ada, "Last week", "2026-11-02", created_at: 3.minutes.ago)
    weekly(ada, "Archived soon", "2026-11-12", status: "archived", created_at: 2.minutes.ago)
    note_for(ada, "Someday", created_at: 1.minute.ago)
    weekly(grace, "Grace soon", "2026-11-12")

    expect(titles_listed("review=next_7_days")).to eq([ "In a week", "Tomorrow" ])

    # Due today, overdue, and the next 7 days never share a note.
    found = %w[due_today overdue next_7_days].to_h { |review| [ review, titles_listed("review=#{review}") ] }
    expect(found).to eq(
      "due_today" => [ "Due now" ], "overdue" => [ "Last week" ], "next_7_days" => [ "In a week", "Tomorrow" ]
    )

    # It is 2026-11-10 in Tokyo: "Tomorrow" is due today there, and "In 8 days" is 7 days on.
    get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }

    expect(titles_listed("review=next_7_days")).to eq([ "In 8 days", "In a week" ])
  end

  it "AC-17 review=unscheduled lists the notes with the interval none in any status" do
    sign_in_with_google
    note_for(ada, "Someday", created_at: 3.minutes.ago)
    note_for(ada, "Old someday", status: "archived", created_at: 2.minutes.ago)
    weekly(ada, "Rails tips", "2026-11-16", created_at: 1.minute.ago)
    note_for(grace, "Grace someday")

    expect(titles_listed("review=unscheduled")).to eq([ "Old someday", "Someday" ])
  end

  it "AC-17 one 422 names every search or filter parameter that breaks a rule" do
    sign_in_with_google
    note_for(ada, "Rails tips")

    # Unknown values, another letter case, a search that is too long, and a search that is
    # not text: a list, or an object.
    {
      "status=deleted&review=soon" => { "status" => "invalid", "review" => "invalid" },
      "status=Active" => { "status" => "invalid" },
      "review=Next_7_Days" => { "review" => "invalid" },
      "search=#{"a" * 2001}&status=deleted&review=soon" => { "search" => "too_long", "status" => "invalid", "review" => "invalid" },
      "search%5B%5D=rails" => { "search" => "invalid" },
      "search%5Ba%5D=b" => { "search" => "invalid" }
    }.each do |query, fields|
      get "/api/notes?#{query}"

      expect(response).to have_http_status(:unprocessable_content)
      # The whole body, in this order: search, status, review.
      expect(response.body).to eq({ error: "validation_failed", fields: fields }.to_json)
    end
  end

  it "AC-17 the search and every filter combine, newest first" do
    sign_in_with_google
    work = ada.collections.create!(name: "Work")
    books = ada.collections.create!(name: "Books")
    ruby = ada.tags.create!(name: "ruby")
    note_for(ada, "Old idea", collection: work, tags: [ ruby ], status: "archived", created_at: 12.minutes.ago)
    note_for(ada, "Work plain", collection: work, created_at: 11.minutes.ago)
    note_for(ada, "Rails tips", collection: work, tags: [ ruby ], created_at: 10.minutes.ago)
    note_for(ada, "Ruby notes", collection: books, tags: [ ruby ], created_at: 9.minutes.ago)
    note_for(ada, "Rails history", collection: books, created_at: 8.minutes.ago)
    note_for(ada, "Ruby again", collection: work, tags: [ ruby ], created_at: 7.minutes.ago)
    # Active and archived notes in each review state.
    weekly(ada, "Due now", "2026-11-09", created_at: 6.minutes.ago)
    weekly(ada, "Archived due", "2026-11-09", status: "archived", created_at: 5.minutes.ago)
    weekly(ada, "Late", "2026-11-02", created_at: 4.minutes.ago)
    weekly(ada, "Archived late", "2026-11-02", status: "archived", created_at: 3.minutes.ago)
    weekly(ada, "Soon", "2026-11-12", created_at: 2.minutes.ago)
    weekly(ada, "Archived soon", "2026-11-12", status: "archived", created_at: 1.minute.ago)
    note_for(ada, "Old someday", status: "archived")

    expect(titles_listed("collection_id=#{work.id}&tag_id=#{ruby.id}&status=active")).to eq([ "Ruby again", "Rails tips" ])
    expect(titles_listed("search=rails&collection_id=#{work.id}")).to eq([ "Rails tips" ])

    # Due today, overdue, and the next 7 days need an active note.
    %w[due_today overdue next_7_days].each do |review|
      expect(titles_listed("status=archived&review=#{review}")).to eq([])
    end
    expect(titles_listed("status=archived&review=unscheduled")).to eq([ "Old someday", "Old idea" ])
  end

  it "AC-17 empty parameters list every note, a request without a sign-in answers 401, and another user's notes never match" do
    # No sign-in: 401 first, whatever the parameters.
    get "/api/notes?search=rails&status=deleted"

    expect(response).to have_http_status(:unauthorized)
    expect(json_body).to eq("error" => "unauthenticated")

    sign_in_with_google
    note_for(ada, "Cooking", body: "Boil water.", created_at: 2.minutes.ago)
    note_for(ada, "Rails tips", created_at: 1.minute.ago)
    secret = grace.collections.create!(name: "Secret")
    private_tag = grace.tags.create!(name: "private")
    note_for(grace, "Secret rails", body: "rails", collection: secret, tags: [ private_tag ])

    expect(titles_listed("search=&collection_id=&tag_id=&status=&review=")).to eq([ "Rails tips", "Cooking" ])
    expect(titles_listed("search=rails")).to eq([ "Rails tips" ])
    expect(titles_listed("collection_id=#{secret.id}")).to eq([])
    expect(titles_listed("tag_id=#{private_tag.id}")).to eq([])
  end
end

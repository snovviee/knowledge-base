require "rails_helper"

# features/17_search_and_filter. GET /api/notes?search= keeps the notes whose title, body, or
# source URL contains the text, each field on its own (spec questions 4 to 6 and 13). A browser
# signs in through the real callback (spec/support/request_helpers.rb). The time is fixed at
# 2026-11-09 20:00 UTC, as in features 12 to 16; the search does not depend on the date.
RSpec.describe "Note search", type: :request do
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

  # The titles of the listed notes, in the answer's order.
  def listed_titles
    json_body["notes"].map { |note| note["title"] }
  end

  # The titles that GET /api/notes answers for the search text, which is sent as a query
  # parameter, encoded as a browser encodes it.
  def titles_found(text)
    get "/api/notes", params: { search: text }
    expect(response).to have_http_status(:ok)
    listed_titles
  end

  it "AC-17 GET /api/notes?search= finds the text in the title, the body, or the source URL, newest first" do
    sign_in_with_google
    note_for(ada, "Framework", body: "A web framework.", source_url: "https://rubyonrails.org", created_at: 4.minutes.ago)
    note_for(ada, "Cooking", body: "Boil water.", created_at: 3.minutes.ago)
    note_for(ada, "Ruby notes", body: "Always use rails generators.", created_at: 2.minutes.ago)
    note_for(ada, "Rails tips", body: "Short tips.", created_at: 1.minute.ago)

    get "/api/notes?search=rails"

    expect(response).to have_http_status(:ok)
    expect(listed_titles).to eq([ "Rails tips", "Ruby notes", "Framework" ])
  end

  it "AC-17 the search ignores letter case in any alphabet but not accents" do
    sign_in_with_google
    note_for(ada, "Привет мир", body: "Hello.", created_at: 2.minutes.ago)
    note_for(ada, "Café", body: "Coffee.", created_at: 1.minute.ago)

    expect(titles_found("ПРИВЕТ")).to eq([ "Привет мир" ])
    expect(titles_found("CAFÉ")).to eq([ "Café" ])
    expect(titles_found("cafe")).to eq([])
  end

  it "AC-17 the search counts each run of whitespace as one space, and only spaces is no search" do
    sign_in_with_google
    # "use" ends the first line of the body, and "rails" starts the second.
    note_for(ada, "Ruby notes", body: "Always use\nrails generators.", created_at: 2.minutes.ago)
    note_for(ada, "Rails tips", body: "Short tips.", created_at: 1.minute.ago)

    expect(titles_found("  rails   tips ")).to eq([ "Rails tips" ])
    expect(titles_found("rails\t\n tips")).to eq([ "Rails tips" ])
    expect(titles_found("use rails")).to eq([ "Ruby notes" ])

    # Only spaces, or nothing: no search, so every note.
    [ "/api/notes?search=%20%20%20", "/api/notes?search=" ].each do |address|
      get address

      expect(response).to have_http_status(:ok)
      expect(listed_titles).to eq([ "Rails tips", "Ruby notes" ])
    end
  end

  it "AC-17 special characters in the search match as themselves" do
    sign_in_with_google
    titles = [ "100% done", "100 done", "a_b", "axb", "a*b", "a\\b", "it's", "say \"hi\"" ]
    titles.each.with_index(1) { |title, age| note_for(ada, title, body: "B", created_at: age.minutes.ago) }

    expect(titles_found("100%")).to eq([ "100% done" ])
    expect(titles_found("a_b")).to eq([ "a_b" ])
    [ "a*b", "a\\b", "it's", "say \"hi\"" ].each do |title|
      expect(titles_found(title)).to eq([ title ])
    end
  end

  it "AC-17 the search looks in each field on its own and not in collection or tag names" do
    sign_in_with_google
    books = ada.collections.create!(name: "Books")
    ruby = ada.tags.create!(name: "ruby")
    note_for(ada, "Book list", body: "Books to read.", collection: books, created_at: 4.minutes.ago)
    note_for(ada, "Framework", body: "A web framework.", collection: books, tags: [ ruby ], created_at: 3.minutes.ago)
    # The title ends with "tips", and the body starts with "Short".
    note_for(ada, "Rails tips", body: "Short tips.", tags: [ ruby ], created_at: 2.minutes.ago)
    note_for(ada, "Ruby notes", body: "Always use rails.", created_at: 1.minute.ago)

    expect(titles_found("tips short")).to eq([])
    expect(titles_found("Books")).to eq([ "Book list" ])
    expect(titles_found("ruby")).to eq([ "Ruby notes" ])
  end

  it "AC-17 a search longer than 2,000 characters after tidying answers 422 too_long" do
    sign_in_with_google
    note_for(ada, "Rails tips")

    get "/api/notes", params: { search: "a" * 2001 }

    expect(response).to have_http_status(:unprocessable_content)
    expect(json_body).to eq("error" => "validation_failed", "fields" => { "search" => "too_long" })

    # The limit counts the text after tidying: the ends trimmed, and each run of whitespace
    # inside one space.
    [ "a" * 2000, "   #{"a" * 2000}   ", "#{"a" * 1000}\n \t#{"a" * 999}" ].each do |text|
      get "/api/notes", params: { search: text }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("notes" => [])
    end
  end
end

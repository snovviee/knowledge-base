require "rails_helper"

# features/17_search_and_filter. A note keeps search copies of its title, body, and source
# URL: each field in Unicode NFC, case-folded in any alphabet, with each run of whitespace
# one space and the ends trimmed, and null for a note with no source URL (spec questions 4
# and 13). The search compares these copies with the search text folded the same way,
# because SQLite's LIKE and LOWER fold only ASCII letters.
RSpec.describe Note, type: :model do
  let(:ada) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:work) { ada.collections.create!(name: "Work") }

  # The note's search copies, as stored.
  def search_copies(note)
    note.reload.attributes.slice("search_title", "search_body", "search_source_url")
  end

  it "AC-17 a saved note keeps its title, body, and source URL folded for search" do
    privet = ada.notes.create!(
      collection: work, title: "Привет Мир", body: "Always use\n\nRAILS  generators.", source_url: "HTTPS://Example.COM/Path"
    )

    expect(search_copies(privet)).to eq(
      "search_title" => "привет мир", "search_body" => "always use rails generators.", "search_source_url" => "https://example.com/path"
    )

    # A combining accent is composed first, so "Cafe" with U+0301 folds as "CAFÉ" does.
    combining = ada.notes.create!(collection: work, title: "Café", body: "B")
    precomposed = ada.notes.create!(collection: work, title: "CAFÉ", body: "B")

    expect(search_copies(combining)).to eq("search_title" => "café", "search_body" => "b", "search_source_url" => nil)
    expect(search_copies(precomposed)["search_title"]).to eq("café")

    # An edit of the body changes its copy, and only its copy.
    privet.update!(body: "Use HOTWIRE\ttoo.")

    expect(search_copies(privet)).to eq(
      "search_title" => "привет мир", "search_body" => "use hotwire too.", "search_source_url" => "https://example.com/path"
    )
  end
end

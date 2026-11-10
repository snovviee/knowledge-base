require "rails_helper"

# features/09_notes_crud. The API sends each validation code as is
# ({ "fields": { "<field>": "<code>" } }), so these examples check the codes.
RSpec.describe Note, type: :model do
  let(:user) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:work) { user.collections.create!(name: "Work") }

  it "AC-09 a note has a tidied title and a body as typed, both required, and starts active" do
    body = "  First line\n\n    an indented line  \n"
    note = user.notes.create!(collection: work, title: "  Rails \t\n  tips  ", body: body)

    note.reload
    expect(note.title).to eq("Rails tips")
    expect(note.body).to eq(body)
    expect(note.status).to eq("active")
    expect(note.user).to eq(user)
    expect(note.collection).to eq(work)

    [ nil, "", "   ", "\t\n" ].each do |blank|
      note = user.notes.new(collection: work, title: blank, body: blank)
      expect(note).not_to be_valid
      expect(note.errors.details[:title]).to include(error: :blank)
      expect(note.errors.details[:body]).to include(error: :blank)
    end
  end

  it "AC-09 a note's collection must be one of its user's collections" do
    grace = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    secret = grace.collections.create!(name: "Secret")
    gone = user.collections.create!(name: "Gone").tap(&:destroy!)

    note = user.notes.new(title: "Rails tips", body: "Use bin/rails.")
    expect(note).not_to be_valid
    expect(note.errors.details[:collection_id]).to include(error: :blank)

    # Another user's collection answers like one that does not exist.
    [ secret.id, gone.id, 0 ].each do |id|
      note = user.notes.new(title: "Rails tips", body: "Use bin/rails.", collection_id: id)
      expect(note).not_to be_valid
      expect(note.errors.details[:collection_id]).to include(a_hash_including(error: :not_found))
    end

    expect(user.notes.new(title: "Rails tips", body: "Use bin/rails.", collection: work)).to be_valid
  end

  it "AC-09 a note's title, body, and source URL have length limits" do
    url_at_limit = "https://example.com/#{'a' * 1980}"
    expect(url_at_limit.length).to eq(2000)

    # Exactly at the limit is valid, and spaces that tidying removes do not count.
    expect(user.notes.new(collection: work, title: "  #{'t' * 200}  ", body: "b" * 100_000, source_url: url_at_limit)).to be_valid
    expect(user.notes.new(collection: work, title: "é" * 200, body: "é" * 100_000)).to be_valid

    note = user.notes.new(collection: work, title: "t" * 201, body: "b" * 100_001, source_url: "#{url_at_limit}a")
    expect(note).not_to be_valid
    expect(note.errors.details[:title]).to include(a_hash_including(error: :too_long))
    expect(note.errors.details[:body]).to include(a_hash_including(error: :too_long))
    expect(note.errors.details[:source_url]).to include(a_hash_including(error: :too_long))
  end

  it "AC-09 a note's source URL is a web address or none" do
    note = user.notes.create!(collection: work, title: "T", body: "B", source_url: "  https://guides.rubyonrails.org/a?b=c#d \n")
    expect(note.reload.source_url).to eq("https://guides.rubyonrails.org/a?b=c#d")

    # Empty, or spaces only (Unicode spaces too), is no source URL.
    [ nil, "", "   ", " \t\n" ].each do |none|
      note = user.notes.new(collection: work, title: "T", body: "B", source_url: none)
      expect(note).to be_valid
      expect(note.source_url).to be_nil
    end

    # http:// or https:// in any letter case, then a host. Kept as typed.
    [ "http://localhost:3000/notes", "HTTPS://Example.com/Page", "https://пример.рф/путь", "https://example.com" ].each do |web|
      note = user.notes.new(collection: work, title: "T", body: "B", source_url: web)
      expect(note).to be_valid
      expect(note.source_url).to eq(web)
    end

    [
      "javascript:alert(1)", "ftp://example.com/file", "example.com", "mailto:ada@example.com", "data:text/html,hi",
      "https://", "https:///path", "https://exa mple.com", "https://example.com/a b"
    ].each do |not_web|
      note = user.notes.new(collection: work, title: "T", body: "B", source_url: not_web)
      expect(note).not_to be_valid
      expect(note.errors.details[:source_url]).to include(a_hash_including(error: :invalid))
    end
  end

  it "AC-09 a note's status is active or archived" do
    %w[active archived].each do |status|
      expect(user.notes.new(collection: work, title: "T", body: "B", status: status)).to be_valid
    end

    [ nil, "", "Archived", "deleted", 1 ].each do |unknown|
      note = user.notes.new(collection: work, title: "T", body: "B", status: unknown)
      expect(note).not_to be_valid
      expect(note.errors.details[:status]).to include(error: :invalid)
    end
  end
end

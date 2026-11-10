require "rails_helper"

# features/10_note_tags. A note carries its tags, and a change of its tags is one
# request. The browser signs in through the real callback, and a request that changes
# data sends this session's anti-forgery token (spec/support/request_helpers.rb).
RSpec.describe "Note tags", type: :request do
  def json_body(from = response)
    JSON.parse(from.body)
  end

  def ada
    User.find_by!(provider: "google_oauth2", provider_user_id: "u-1")
  end

  def grace
    User.find_or_create_by!(provider: "github", provider_user_id: "42") { |user| user.display_name = "Grace" }
  end

  # A note of the user in their "Work" collection, with the given tags (names).
  def note_with_tags(user, title, tag_names = [])
    work = user.collections.find_or_create_by!(name: "Work")
    note = user.notes.create!(collection: work, title: title, body: "Body of #{title}")
    tag_names.each { |name| note.add_tag(user.tags.find_or_create_by!(name: name)) }
    note
  end

  describe "GET /api/notes and GET /api/notes/:id" do
    it "AC-10 GET /api/notes and GET /api/notes/:id carry each note's tags in alphabetical order" do
      sign_in_with_google
      tagged = note_with_tags(ada, "Rails tips", %w[web Ruby])
      untagged = note_with_tags(ada, "Plain")
      note_with_tags(grace, "Secret plan", %w[secret])

      get "/api/notes"

      notes = json_body["notes"].index_by { |note| note["id"] }
      expect(notes[tagged.id]["tags"]).to eq([
        { "id" => ada.tags.find_by!(name: "Ruby").id, "name" => "Ruby" },
        { "id" => ada.tags.find_by!(name: "web").id, "name" => "web" }
      ])
      expect(notes[untagged.id]["tags"]).to eq([])
      expect(notes.size).to eq(2)

      get "/api/notes/#{tagged.id}"

      expect(json_body["note"]["tags"].map { |tag| tag["name"] }).to eq(%w[Ruby web])
    end
  end

  describe "POST /api/notes with tag_ids" do
    def create_note(body, token: csrf_token)
      post "/api/notes", params: body, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-10 POST /api/notes with tag_ids creates the note with those tags" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      ruby = ada.tags.create!(name: "ruby")
      web = ada.tags.create!(name: "web")
      token = csrf_token

      expect { create_note({ title: "Rails tips", body: "B", collection_id: work.id, tag_ids: [ web.id, ruby.id ] }, token: token) }
        .to change(Note, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json_body["note"]["tags"]).to eq([
        { "id" => ruby.id, "name" => "ruby" },
        { "id" => web.id, "name" => "web" }
      ])
      expect(Note.find(json_body["note"]["id"]).tags).to contain_exactly(ruby, web)
    end
  end

  describe "tag_ids that are refused" do
    def create_note(body, token: csrf_token)
      post "/api/notes", params: body, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-10 a tag id that is not one of the user's tags answers 422 not_found and changes nothing" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      ruby = ada.tags.create!(name: "ruby")
      secret = grace.tags.create!(name: "secret")
      token = csrf_token

      [ [ ruby.id, secret.id ], [ 999_999 ], [ "abc" ], [ 1.5 ] ].each do |ids|
        expect { create_note({ title: "T", body: "B", collection_id: work.id, tag_ids: ids }, token: token) }
          .not_to change { [ Note.count, NoteTag.count ] }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "tag_ids" => "not_found" })
      end
    end
  end

  describe "tag_ids that is not a list" do
    def create_note(body, token: csrf_token)
      post "/api/notes", params: body, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-10 tag_ids that is not a list answers 422 invalid and changes nothing" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      ruby = ada.tags.create!(name: "ruby")
      token = csrf_token

      [ "ruby", 42, { id: ruby.id }, nil ].each do |bad|
        expect { create_note({ title: "T", body: "B", collection_id: work.id, tag_ids: bad }, token: token) }
          .not_to change { [ Note.count, NoteTag.count ] }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "tag_ids" => "invalid" })
      end
    end
  end

  describe "POST /api/notes without tag_ids" do
    it "AC-10 POST /api/notes without tag_ids creates a note with no tags" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      ada.tags.create!(name: "ruby")
      token = csrf_token

      post "/api/notes", params: { title: "T", body: "B", collection_id: work.id }, headers: { "X-CSRF-Token" => token }, as: :json

      expect(response).to have_http_status(:created)
      expect(json_body["note"]["tags"]).to eq([])
      expect(Note.find(json_body["note"]["id"]).tags).to be_empty
    end
  end

  describe "PATCH /api/notes/:id with tag_ids" do
    def edit_note(id, fields, token: csrf_token)
      patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-10 PATCH /api/notes/:id with tag_ids sets the note's tags to exactly that set" do
      sign_in_with_google
      note = note_with_tags(ada, "Rails tips", %w[ruby web])
      rails = ada.tags.create!(name: "rails")
      token = csrf_token

      edit_note(note.id, { tag_ids: [ rails.id, ada.tags.find_by!(name: "ruby").id ] }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]["tags"].map { |tag| tag["name"] }).to eq(%w[rails ruby])
      expect(note.reload.tags.map(&:name)).to contain_exactly("ruby", "rails")
      expect(ada.tags.find_by!(name: "web").notes).to be_empty
    end
  end

  describe "PATCH /api/notes/:id with an empty or missing tag_ids" do
    def edit_note(id, fields, token: csrf_token)
      patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-10 PATCH /api/notes/:id with an empty tag_ids removes every tag" do
      sign_in_with_google
      note = note_with_tags(ada, "Rails tips", %w[ruby web])
      token = csrf_token

      edit_note(note.id, { tag_ids: [] }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]["tags"]).to eq([])
      expect(note.reload.tags).to be_empty
    end

    it "AC-10 PATCH /api/notes/:id without tag_ids keeps the note's tags, even when another tab added one" do
      sign_in_with_google
      note = note_with_tags(ada, "Rails tips", %w[ruby])
      # Another tab adds "web" to the note after this form loaded its tags.
      note.add_tag(ada.tags.create!(name: "web"))
      token = csrf_token

      edit_note(note.id, { title: "Rails guides" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]["tags"].map { |tag| tag["name"] }).to eq(%w[ruby web])
      expect(note.reload.tags.map(&:name)).to contain_exactly("ruby", "web")
    end
  end

  describe "the updated date of a note whose tags change" do
    def edit_note(id, fields, token: csrf_token)
      patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-10 only an edit that changes a note's tags changes its updated date" do
      sign_in_with_google
      note = note_with_tags(ada, "Rails tips", %w[ruby])
      web = ada.tags.create!(name: "web")
      token = csrf_token
      stamped = 1.day.ago.change(usec: 0)
      note.update_column(:updated_at, stamped)

      # An edit that changes the tags changes the updated date.
      edit_note(note.id, { tag_ids: [ *note.tags.pluck(:id), web.id ] }, token: token)
      expect(note.reload.updated_at).to be > stamped

      # An edit that sends the same set changes nothing.
      changed = note.updated_at
      edit_note(note.id, { tag_ids: note.tags.pluck(:id) }, token: token)
      expect(note.reload.updated_at).to eq(changed)

      # A tag renamed or deleted in the tags area changes no note's updated date.
      unchanged = note.updated_at
      ada.tags.find_by!(name: "web").update!(name: "frontend")
      expect(note.reload.updated_at).to eq(unchanged)
      ada.tags.find_by!(name: "frontend").destroy!
      expect(note.reload.updated_at).to eq(unchanged)
    end
  end

  describe "the same tag id twice" do
    it "AC-10 the same tag id twice in tag_ids links the note to it once" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      ruby = ada.tags.create!(name: "ruby")
      token = csrf_token

      post "/api/notes", params: { title: "T", body: "B", collection_id: work.id, tag_ids: [ ruby.id, ruby.id ] },
           headers: { "X-CSRF-Token" => token }, as: :json

      expect(response).to have_http_status(:created)
      expect(json_body["note"]["tags"]).to eq([ { "id" => ruby.id, "name" => "ruby" } ])
      expect(NoteTag.where(tag_id: ruby.id).count).to eq(1)
    end
  end

  describe "a refused request with tag_ids and other fields" do
    def edit_note(id, fields, token: csrf_token)
      patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-10 a refused create or edit with tag_ids changes no field" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      note = note_with_tags(ada, "Rails tips", %w[ruby])
      web = ada.tags.create!(name: "web")
      token = csrf_token

      # A create with a blank title and a tag that is not the user's: both fields are named.
      post "/api/notes", params: { title: " ", body: "B", collection_id: work.id, tag_ids: [ web.id, 999_999 ] },
           headers: { "X-CSRF-Token" => token }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "title" => "blank", "tag_ids" => "not_found" })
      expect(Note.count).to eq(1)

      # An edit with a too-long title and a non-list tag_ids: both are named, and nothing changes.
      before = [ note.reload.title, note.updated_at, note.tags.pluck(:id) ]
      edit_note(note.id, { title: "t" * 201, tag_ids: "web" }, token: token)
      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "title" => "too_long", "tag_ids" => "invalid" })
      expect([ note.reload.title, note.updated_at, note.tags.pluck(:id) ]).to eq(before)
    end
  end

  describe "a tag deleted before the request" do
    it "AC-10 a create whose tag was deleted answers 422 tag_ids not_found and creates no note" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      ruby = ada.tags.create!(name: "ruby")
      ruby.destroy!
      token = csrf_token

      expect {
        post "/api/notes", params: { title: "T", body: "B", collection_id: work.id, tag_ids: [ ruby.id ] },
             headers: { "X-CSRF-Token" => token }, as: :json
      }.not_to change { [ Note.count, NoteTag.count ] }

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "tag_ids" => "not_found" })
    end
  end

  # A tag deleted after the check of the tag ids passed and before its link is written
  # (plan items 31 and 32). The race is forced as features/09_notes_crud forces its
  # collection race: the check is skipped, and the tag is gone before the request.
  describe "a tag deleted during the request" do
    it "AC-10 an edit whose tag is deleted during the request answers 422 tag_ids not_found and changes no field" do
      sign_in_with_google
      note = note_with_tags(ada, "Rails tips", %w[web])
      web = note.tags.first
      ruby = ada.tags.create!(name: "ruby").tap(&:destroy!)
      token = csrf_token
      before = [ note.reload.title, note.updated_at, note.tags.pluck(:id) ]
      allow_any_instance_of(Note).to receive(:tags_of_the_user)

      patch "/api/notes/#{note.id}", params: { title: "New title", tag_ids: [ web.id, ruby.id ] },
            headers: { "X-CSRF-Token" => token }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "tag_ids" => "not_found" })
      expect([ note.reload.title, note.updated_at, note.tags.pluck(:id) ]).to eq(before)
    end

    it "AC-10 a create whose tag is deleted during the request answers 422 tag_ids not_found and creates no note" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      ruby = ada.tags.create!(name: "ruby").tap(&:destroy!)
      token = csrf_token
      allow_any_instance_of(Note).to receive(:tags_of_the_user)

      expect {
        post "/api/notes", params: { title: "T", body: "B", collection_id: work.id, tag_ids: [ ruby.id ] },
             headers: { "X-CSRF-Token" => token }, as: :json
      }.not_to change { [ Note.count, NoteTag.count ] }

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "tag_ids" => "not_found" })
    end
  end

  describe "a collection race with tags on the note" do
    it "AC-10 a note create that loses a race with its collection still answers collection_id not_found with tags" do
      sign_in_with_google
      token = csrf_token
      ruby = ada.tags.create!(name: "ruby")
      # The collection was deleted after the check passed; the tag is fine.
      temp = ada.collections.create!(name: "Temp").tap(&:destroy!)
      allow_any_instance_of(Note).to receive(:valid?).and_return(true)

      expect {
        post "/api/notes", params: { title: "T", body: "B", collection_id: temp.id, tag_ids: [ ruby.id ] },
             headers: { "X-CSRF-Token" => token }, as: :json
      }.not_to change { [ Note.count, NoteTag.count ] }

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "collection_id" => "not_found" })
    end
  end

  describe "the anti-forgery token and sign-in on tag changes" do
    it "AC-10 note tag changes without the anti-forgery token answer 403 and change nothing" do
      other_token = csrf_token(open_session)
      sign_in_with_google
      note = note_with_tags(ada, "Rails tips", %w[ruby])
      web = ada.tags.create!(name: "web")

      [ {}, { "X-CSRF-Token" => other_token } ].each do |headers|
        post "/api/notes", params: { title: "T", body: "B", collection_id: note.collection_id, tag_ids: [ web.id ] },
             headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")

        patch "/api/notes/#{note.id}", params: { tag_ids: [ web.id ] }, headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")
      end

      expect(note.reload.tags.map(&:name)).to eq([ "ruby" ])
      expect(Note.count).to eq(1)
    end

    it "AC-10 note tag changes with no sign-in answer 401 with or without a token and change nothing" do
      note = note_with_tags(grace, "Secret", %w[secret])
      token = csrf_token

      [ {}, { "X-CSRF-Token" => token } ].each do |headers|
        patch "/api/notes/#{note.id}", params: { tag_ids: [] }, headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")
      end

      expect(note.reload.tags.map(&:name)).to eq([ "secret" ])
    end
  end
end

require "rails_helper"

# features/09_notes_crud. A browser signs in through the real callback, and a request
# that changes data sends this session's anti-forgery token, as the app does
# (sign_in_with_google and csrf_token: spec/support/request_helpers.rb).
RSpec.describe "Notes", type: :request do
  def json_body(from = response)
    JSON.parse(from.body)
  end

  # The user that sign_in_with_google signs in by default.
  def ada
    User.find_by!(provider: "google_oauth2", provider_user_id: "u-1")
  end

  def grace
    User.find_or_create_by!(provider: "github", provider_user_id: "42") { |user| user.display_name = "Grace" }
  end

  # A note of the user, in their collection of that name. The attributes override
  # the defaults.
  def note_for(user, title, collection: "Work", **attributes)
    collection = user.collections.find_or_create_by!(name: collection)
    user.notes.create!({ collection: collection, title: title, body: "Body of #{title}" }.merge(attributes))
  end

  # The full note, as a read, a create, and an edit answer it.
  def full_json(note)
    note.reload
    {
      "id" => note.id, "title" => note.title, "body" => note.body, "source_url" => note.source_url,
      "status" => note.status, "collection" => { "id" => note.collection.id, "name" => note.collection.name },
      "tags" => [], "created_at" => note.created_at.as_json, "updated_at" => note.updated_at.as_json,
      "review_state" => nil, # Neither due today nor overdue (features/15_review_due_today).
      # A note with no review schedule (features/12_review_interval_setting).
      "review_interval" => "none", "review_interval_days" => nil, "next_review_date" => nil, "last_reviewed_date" => nil
    }
  end

  describe "GET /api/notes" do
    it "AC-09 GET /api/notes lists only the signed-in user's notes, newest first" do
      sign_in_with_google
      # Created in another order than their ids, so the order is by the created date.
      second = note_for(ada, "Second", collection: "Books", created_at: 1.minute.ago)
      first = note_for(ada, "First", collection: "Work", created_at: 2.minutes.ago)
      third = note_for(ada, "Third", collection: "Books", status: "archived")
      note_for(grace, "Secret plan", collection: "Secret")

      get "/api/notes"

      expect(response).to have_http_status(:ok)
      expect(json_body["notes"].map { |note| note["title"] }).to eq(%w[Third Second First])
      expect(json_body["notes"].first).to eq(
        "id" => third.id, "title" => "Third", "status" => "archived",
        "collection" => { "id" => second.collection_id, "name" => "Books" }, "tags" => [],
        "created_at" => third.created_at.as_json, "updated_at" => third.updated_at.as_json,
        "review_state" => nil, # Neither due today nor overdue (features/15_review_due_today).
        "review_interval" => "none", "review_interval_days" => nil, "next_review_date" => nil, "last_reviewed_date" => nil
      )
      expect(json_body["notes"].last["collection"]).to eq("id" => first.collection_id, "name" => "Work")
    end
  end

  describe "GET /api/notes/:id" do
    it "AC-09 GET /api/notes/:id answers 200 with the note" do
      sign_in_with_google
      note = note_for(ada, "Rails tips", body: "Line one\nLine two", source_url: "https://guides.rubyonrails.org")

      get "/api/notes/#{note.id}"

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("note" => full_json(note))
      expect(json_body["note"]).to include(
        "body" => "Line one\nLine two", "source_url" => "https://guides.rubyonrails.org", "status" => "active",
        "collection" => { "id" => note.collection_id, "name" => "Work" }
      )
    end
  end

  describe "POST /api/notes" do
    # Creates a note as the app does: a JSON body and this session's token.
    def create_note(body, token: csrf_token)
      post "/api/notes", params: body, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-09 POST /api/notes creates a note in one of the user's collections and answers 201 with it" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      # Two notes may have the same title.
      note_for(ada, "Rails tips", collection: "Work")

      expect {
        create_note({
          title: "  Rails   tips ", body: "Use bin/rails.\n", source_url: " https://guides.rubyonrails.org ",
          collection_id: work.id, status: "archived", user_id: grace.id
        })
      }.to change { ada.notes.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_body).to eq("note" => full_json(ada.notes.newest_first.first))
      # Tidied, active whatever the body says, and the signed-in user's.
      expect(json_body["note"]).to include(
        "title" => "Rails tips", "body" => "Use bin/rails.\n", "source_url" => "https://guides.rubyonrails.org",
        "status" => "active", "collection" => { "id" => work.id, "name" => "Work" }
      )
      expect(grace.notes).to be_empty
    end

    it "AC-09 POST /api/notes refuses invalid fields with 422 and a code for each" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      secret = grace.collections.create!(name: "Secret")
      token = csrf_token

      {
        { title: "   ", body: "b" * 100_001, source_url: "javascript:alert(1)", collection_id: work.id } =>
          { "title" => "blank", "body" => "too_long", "source_url" => "invalid" },
        # A source URL that is too long and not a web address answers its first code.
        { title: "t" * 201, body: " \n ", source_url: "ftp://#{'a' * 2000}", collection_id: work.id } =>
          { "title" => "too_long", "body" => "blank", "source_url" => "too_long" },
        { title: "T", body: "B", source_url: "example.com", collection_id: work.id } => { "source_url" => "invalid" },
        { title: "T", body: "B", collection_id: secret.id } => { "collection_id" => "not_found" }
      }.each do |fields, codes|
        expect { create_note(fields, token: token) }.not_to change(Note, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => codes)
      end
    end

    it "AC-09 POST /api/notes treats missing and non-text values by each field's rule" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      secret = grace.collections.create!(name: "Secret")
      token = csrf_token
      refused = ->(codes) { { "error" => "validation_failed", "fields" => codes } }

      # A title or a body that is missing, null, or not text is blank.
      [ {}, { title: nil, body: nil }, { title: 42, body: [ "B" ] }, { title: { text: "T" }, body: true } ].each do |fields|
        expect { create_note(fields.merge(collection_id: work.id), token: token) }.not_to change(Note, :count)
        expect(json_body).to eq(refused.({ "title" => "blank", "body" => "blank" }))
      end

      # A source URL that is not text is invalid.
      [ 42, [ "https://example.com" ], { href: "https://example.com" }, true ].each do |source_url|
        create_note({ title: "T", body: "B", source_url: source_url, collection_id: work.id }, token: token)
        expect(json_body).to eq(refused.({ "source_url" => "invalid" }))
      end

      # A collection that is missing or null is blank.
      [ {}, { collection_id: nil } ].each do |fields|
        create_note({ title: "T", body: "B" }.merge(fields), token: token)
        expect(json_body).to eq(refused.({ "collection_id" => "blank" }))
      end

      # A value that is not a whole number, another user's collection, and a missing one are not_found.
      [ "abc", work.id.to_s, [ work.id ], { id: work.id }, work.id + 0.5, true, secret.id, 999_999 ].each do |collection_id|
        expect { create_note({ title: "T", body: "B", collection_id: collection_id }, token: token) }.not_to change(Note, :count)
        expect(json_body).to eq(refused.({ "collection_id" => "not_found" }))
      end

      # A source URL that is missing or null is none.
      [ {}, { source_url: nil } ].each do |fields|
        expect { create_note({ title: "T", body: "B", collection_id: work.id }.merge(fields), token: token) }
          .to change(Note, :count).by(1)
        expect(json_body["note"]["source_url"]).to be_nil
      end
    end

    it "AC-09 a note create that loses a race with its collection's delete answers 422 not_found" do
      sign_in_with_google
      token = csrf_token
      # Another request deleted "Temp" after this request's check had passed. The
      # check is skipped here, so the database refuses the row.
      temp = ada.collections.create!(name: "Temp").tap(&:destroy!)
      allow_any_instance_of(Note).to receive(:valid?).and_return(true)

      expect { create_note({ title: "T", body: "B", collection_id: temp.id }, token: token) }.not_to change(Note, :count)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "collection_id" => "not_found" })
    end
  end

  describe "PATCH /api/notes/:id" do
    # Edits a note as the app does: a JSON body and this session's token.
    def edit_note(id, fields, token: csrf_token)
      patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-09 PATCH /api/notes/:id edits the sent fields and answers 200 with the note" do
      sign_in_with_google
      note = note_for(ada, "Rails tips", body: "Use bin/rails.", source_url: "https://guides.rubyonrails.org")
      token = csrf_token

      edit_note(note.id, { title: "  Rails   guides ", body: "Read the guides.\n", source_url: " https://rubyonrails.org " }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("note" => full_json(note))
      expect(note).to have_attributes(title: "Rails guides", body: "Read the guides.\n", source_url: "https://rubyonrails.org")

      # Only the sent fields change. (A collection_id moves the note: features/11_note_move.)
      edit_note(note.id, { body: "Only the body." }, token: token)

      expect(response).to have_http_status(:ok)
      expect(note.reload).to have_attributes(
        title: "Rails guides", body: "Only the body.", source_url: "https://rubyonrails.org", collection: ada.collections.find_by!(name: "Work")
      )

      # An empty or null source URL removes it.
      [ "", nil ].each do |none|
        note.update!(source_url: "https://rubyonrails.org")
        edit_note(note.id, { source_url: none }, token: token)

        expect(response).to have_http_status(:ok)
        expect(json_body["note"]["source_url"]).to be_nil
        expect(note.reload.source_url).to be_nil
      end
    end

    it "AC-09 PATCH /api/notes/:id archives and restores a note" do
      sign_in_with_google
      note = note_for(ada, "Rails tips")
      token = csrf_token

      edit_note(note.id, { status: "archived" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("note" => full_json(note))
      expect(note.status).to eq("archived")

      # Archiving an archived note changes nothing.
      expect { edit_note(note.id, { status: "archived" }, token: token) }.not_to change { note.reload.updated_at }
      expect(response).to have_http_status(:ok)

      # An edit of an archived note keeps it archived.
      edit_note(note.id, { title: "Rails guides" }, token: token)
      expect(note.reload).to have_attributes(title: "Rails guides", status: "archived")

      edit_note(note.id, { status: "active" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]["status"]).to eq("active")
      expect(note.reload.status).to eq("active")

      # Restoring an active note changes nothing.
      expect { edit_note(note.id, { status: "active" }, token: token) }.not_to change { note.reload.updated_at }
      expect(response).to have_http_status(:ok)
    end

    it "AC-09 PATCH /api/notes/:id refuses invalid fields with 422 and keeps the note" do
      sign_in_with_google
      note = note_for(ada, "Rails tips", source_url: "https://guides.rubyonrails.org")
      token = csrf_token

      {
        { title: "  " } => { "title" => "blank" },
        { title: nil, body: 42 } => { "title" => "blank", "body" => "blank" },
        { title: "t" * 201, body: "b" * 100_001 } => { "title" => "too_long", "body" => "too_long" },
        { source_url: "javascript:alert(1)" } => { "source_url" => "invalid" },
        { source_url: [ "https://example.com" ] } => { "source_url" => "invalid" },
        { source_url: "https://example.com/#{'a' * 2000}" } => { "source_url" => "too_long" },
        { status: "deleted" } => { "status" => "invalid" },
        { status: nil } => { "status" => "invalid" },
        { status: 1 } => { "status" => "invalid" }
      }.each do |fields, codes|
        expect { edit_note(note.id, fields, token: token) }.not_to change { note.reload.attributes }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => codes)
      end
    end
  end

  describe "DELETE /api/notes/:id" do
    it "AC-09 DELETE /api/notes/:id deletes the note and answers 204" do
      sign_in_with_google
      note = note_for(ada, "Rails tips")
      note_for(ada, "Keep me")

      delete "/api/notes/#{note.id}", headers: { "X-CSRF-Token" => csrf_token }

      expect(response).to have_http_status(:no_content)
      expect(response.body).to be_empty
      get "/api/notes"
      expect(json_body["notes"].map { |listed| listed["title"] }).to eq([ "Keep me" ])
    end
  end

  describe "another user's or a missing note" do
    it "AC-09 reading, editing, or deleting another user's or a missing note answers 404 and changes nothing" do
      secret = note_for(grace, "Secret plan", collection: "Secret")
      gone = note_for(grace, "Gone").tap(&:destroy!)
      sign_in_with_google
      token = csrf_token

      [ secret.id, gone.id, "not-a-number" ].each do |id|
        get "/api/notes/#{id}"
        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")

        # An edit, an archive, and a delete.
        [ { title: "Hacked" }, { status: "archived" } ].each do |fields|
          patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
          expect(response).to have_http_status(:not_found)
          expect(json_body).to eq("error" => "not_found")
        end

        delete "/api/notes/#{id}", headers: { "X-CSRF-Token" => token }
        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")
      end

      expect(secret.reload).to have_attributes(title: "Secret plan", status: "active")
    end
  end

  describe "a body that is not JSON" do
    it "AC-09 a notes request whose body is not valid JSON answers 400" do
      sign_in_with_google
      note = note_for(ada, "Rails tips")
      headers = { "X-CSRF-Token" => csrf_token, "Content-Type" => "application/json" }

      expect { post "/api/notes", params: '{"title": "Half', headers: headers }.not_to change(Note, :count)
      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      patch "/api/notes/#{note.id}", params: "{", headers: headers
      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      expect(note.reload.title).to eq("Rails tips")
    end
  end

  describe "the anti-forgery token" do
    it "AC-09 note create, edit, and delete without this session's anti-forgery token answer 403 and change nothing" do
      # A token that another browser's session got is not this session's token.
      other_token = csrf_token(open_session)
      sign_in_with_google
      note = note_for(ada, "Rails tips")

      [ {}, { "X-CSRF-Token" => other_token } ].each do |headers|
        post "/api/notes", params: { title: "New", body: "B", collection_id: note.collection_id }, headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")

        [ { title: "Renamed" }, { status: "archived" } ].each do |fields|
          patch "/api/notes/#{note.id}", params: fields, headers: headers, as: :json
          expect(response).to have_http_status(:forbidden)
          expect(json_body).to eq("error" => "invalid_csrf_token")
        end

        delete "/api/notes/#{note.id}", headers: headers
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")
      end

      expect(ada.notes.pluck(:title, :status)).to eq([ [ "Rails tips", "active" ] ])
    end
  end

  describe "no sign-in" do
    it "AC-09 the notes requests answer 401 with no sign-in, with or without a token" do
      note = note_for(grace, "Rails tips")
      # This browser's own token, from a session with no sign-in.
      token = csrf_token
      unauthenticated = lambda do
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")
      end

      get "/api/notes"
      unauthenticated.call
      get "/api/notes/#{note.id}"
      unauthenticated.call

      [ {}, { "X-CSRF-Token" => token } ].each do |headers|
        post "/api/notes", params: { title: "New", body: "B", collection_id: note.collection_id }, headers: headers, as: :json
        unauthenticated.call

        [ { title: "Renamed" }, { status: "archived" } ].each do |fields|
          patch "/api/notes/#{note.id}", params: fields, headers: headers, as: :json
          unauthenticated.call
        end

        delete "/api/notes/#{note.id}", headers: headers
        unauthenticated.call
      end

      # A sign-in that has ended (a logout deletes it, features/05_logout) counts as no one.
      sign_in_with_google
      SignIn.delete_all
      get "/api/notes"
      unauthenticated.call

      expect(Note.pluck(:title, :status)).to eq([ [ "Rails tips", "active" ] ])
    end
  end

  # Feature 07 decides what deleting a collection does to its notes (AC-07). Until then
  # the delete is refused, so no note is lost or left without a collection (spec
  # question 15).
  describe "deleting a collection that has notes" do
    it "AC-09 deleting a collection that has notes answers 409 and keeps the collection and its notes" do
      sign_in_with_google
      note = note_for(ada, "Rails tips", collection: "Work")
      empty = ada.collections.create!(name: "Empty")
      token = csrf_token

      expect { delete "/api/collections/#{note.collection_id}", headers: { "X-CSRF-Token" => token } }
        .not_to change { [ Collection.count, Note.count ] }

      expect(response).to have_http_status(:conflict)
      expect(json_body).to eq("error" => "collection_not_empty")
      expect(note.reload.collection.name).to eq("Work")

      # A collection with no notes is still deleted.
      delete "/api/collections/#{empty.id}", headers: { "X-CSRF-Token" => token }

      expect(response).to have_http_status(:no_content)
      expect(ada.collections.pluck(:name)).to eq([ "Work" ])
    end
  end
end

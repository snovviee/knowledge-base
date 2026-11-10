require "rails_helper"

# features/11_note_move. A note moves to another of the user's collections with
# collection_id on its edit. The browser signs in through the real callback, and a
# request that changes data sends this session's anti-forgery token, as the app does
# (sign_in_with_google and csrf_token: spec/support/request_helpers.rb).
RSpec.describe "Note move", type: :request do
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

  # The full note, as an edit answers it.
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

  # Edits a note as the app does: a JSON body and this session's token.
  def edit_note(id, fields, token: csrf_token)
    patch "/api/notes/#{id}", params: fields, headers: { "X-CSRF-Token" => token }, as: :json
  end

  describe "PATCH /api/notes/:id with collection_id" do
    it "AC-11 PATCH /api/notes/:id with collection_id moves the note to that collection" do
      sign_in_with_google
      note_for(ada, "Older", created_at: 2.minutes.ago)
      note = note_for(ada, "Rails tips", created_at: 1.minute.ago)
      note_for(ada, "Newer")
      books = ada.collections.create!(name: "Books")

      edit_note(note.id, { collection_id: books.id })

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("note" => full_json(note))
      expect(json_body["note"]["collection"]).to eq("id" => books.id, "name" => "Books")
      expect(note.reload.collection).to eq(books)

      # The moved note keeps its place in the list, which is ordered by the created date.
      get "/api/notes"
      expect(json_body["notes"].map { |listed| listed["title"] }).to eq([ "Newer", "Rails tips", "Older" ])
      expect(json_body["notes"][1]["collection"]).to eq("id" => books.id, "name" => "Books")
    end
  end

  describe "an edit without a move" do
    it "AC-11 an edit without collection_id keeps the note in its collection" do
      sign_in_with_google
      note = note_for(ada, "Rails tips")
      work = note.collection
      ada.collections.create!(name: "Books")
      token = csrf_token

      edit_note(note.id, { title: "Rails guides" }, token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body["note"]["collection"]).to eq("id" => work.id, "name" => "Work")
      expect(note.reload).to have_attributes(title: "Rails guides", collection: work)

      # The note's own collection changes nothing, its updated date included.
      expect { edit_note(note.id, { collection_id: work.id }, token: token) }.not_to change { note.reload.attributes }
      expect(response).to have_http_status(:ok)
      expect(json_body["note"]["collection"]).to eq("id" => work.id, "name" => "Work")
    end
  end

  describe "a collection_id that is refused" do
    it "AC-11 a null collection_id answers 422 blank and the note stays" do
      sign_in_with_google
      note = note_for(ada, "Rails tips")

      expect { edit_note(note.id, { collection_id: nil }) }.not_to change { note.reload.attributes }

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "collection_id" => "blank" })
    end

    it "AC-11 a collection_id that is not one of the user's collections answers 422 not_found and the note stays" do
      sign_in_with_google
      note = note_for(ada, "Rails tips")
      books = ada.collections.create!(name: "Books")
      secret = grace.collections.create!(name: "Secret")
      gone = ada.collections.create!(name: "Gone").tap(&:destroy!)
      token = csrf_token

      # Another user's collection, a deleted one, one that never existed, and values that
      # are not a whole number (even when they name the user's "Books"): the same answer.
      [ secret.id, gone.id, 999_999, "abc", books.id.to_s, [ books.id ], { id: books.id }, books.id + 0.5, true ].each do |collection_id|
        expect { edit_note(note.id, { collection_id: collection_id }, token: token) }.not_to change { note.reload.attributes }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "collection_id" => "not_found" })
      end
    end

    it "AC-11 a move refused with another field changes nothing" do
      sign_in_with_google
      note = note_for(ada, "Rails tips")
      books = ada.collections.create!(name: "Books")
      secret = grace.collections.create!(name: "Secret")
      token = csrf_token

      {
        # A move to one of the user's collections, with a title that breaks a rule.
        { collection_id: books.id, title: " " } => { "title" => "blank" },
        # A refused move with other fields that break a rule: every field is named.
        { collection_id: secret.id, title: "t" * 201, source_url: "javascript:alert(1)" } =>
          { "title" => "too_long", "source_url" => "invalid", "collection_id" => "not_found" },
        { collection_id: nil, body: " " } => { "body" => "blank", "collection_id" => "blank" }
      }.each do |fields, codes|
        expect { edit_note(note.id, fields, token: token) }.not_to change { note.reload.attributes }

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => codes)
      end
    end
  end

  describe "a move at the same moment as the delete of its collection" do
    it "AC-11 a move whose target collection is deleted during the request answers 422 not_found" do
      sign_in_with_google
      note = note_for(ada, "Rails tips")
      books = ada.collections.create!(name: "Books")
      token = csrf_token

      # The move comes first: the note is in "Books", so the delete of "Books" is
      # refused (features/07_collection_delete_rule).
      edit_note(note.id, { collection_id: books.id }, token: token)
      expect(response).to have_http_status(:ok)
      expect { delete "/api/collections/#{books.id}", headers: { "X-CSRF-Token" => token } }.not_to change(Collection, :count)
      expect(response).to have_http_status(:conflict)
      expect(json_body).to eq("error" => "collection_not_empty")

      # The delete comes first: another request deleted "Temp" after this request's
      # check had passed. The check is skipped here, so the database refuses the row.
      temp = ada.collections.create!(name: "Temp").tap(&:destroy!)
      allow_any_instance_of(Note).to receive(:valid?).and_return(true)

      expect { edit_note(note.id, { collection_id: temp.id }, token: token) }.not_to change { note.reload.attributes }

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "collection_id" => "not_found" })
      expect(note.reload.collection).to eq(books)
    end
  end

  describe "a move that is not allowed" do
    it "AC-11 a move without a sign-in, without the anti-forgery token, or of another user's note answers 401, 403, or 404 and changes nothing" do
      secret = note_for(grace, "Secret plan", collection: "Secret")
      grace_other = grace.collections.create!(name: "Other")
      # A token that another browser's session got is not this session's token.
      other_token = csrf_token(open_session)

      # No sign-in, with or without this browser's own token.
      token = csrf_token
      [ {}, { "X-CSRF-Token" => token } ].each do |headers|
        patch "/api/notes/#{secret.id}", params: { collection_id: grace_other.id }, headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")
      end

      # Signed in, without this session's token.
      sign_in_with_google
      note = note_for(ada, "Rails tips")
      books = ada.collections.create!(name: "Books")
      [ {}, { "X-CSRF-Token" => other_token } ].each do |headers|
        patch "/api/notes/#{note.id}", params: { collection_id: books.id }, headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")
      end

      # Another user's note, into one of their collections or one of mine.
      token = csrf_token
      [ grace_other.id, books.id ].each do |collection_id|
        edit_note(secret.id, { collection_id: collection_id }, token: token)
        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")
      end

      expect(note.reload.collection.name).to eq("Work")
      expect(secret.reload.collection.name).to eq("Secret")
    end
  end
end

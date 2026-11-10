require "rails_helper"

# features/07_collection_delete_rule. A collection with notes, archived ones included,
# is not deleted: the API answers 409 collection_not_empty, and the collection and its
# notes stay. A collection with no notes is deleted with 204. The 409 and the foreign
# key were built by features/09_notes_crud (its item 20), so these tests pass at once.
# They are kept as the AC-07 tests (plan.md, items 1 to 8).
RSpec.describe "Collection delete rule", type: :request do
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

  # A note in one of the collection's user's collections.
  def note_in(collection, title: "Rails tips", status: "active")
    collection.user.notes.create!(title: title, body: "Body", collection: collection, status: status)
  end

  describe "DELETE /api/collections/:id" do
    it "AC-07 deleting a collection with an active note answers 409 and keeps the collection and its note" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      note = note_in(work)
      token = csrf_token

      expect { delete "/api/collections/#{work.id}", headers: { "X-CSRF-Token" => token } }
        .not_to change { [ Collection.count, Note.count ] }

      expect(response).to have_http_status(:conflict)
      expect(json_body).to eq("error" => "collection_not_empty")
      expect(note.reload.collection.name).to eq("Work")
    end

    it "AC-07 deleting a collection whose notes are all archived answers 409 and keeps the collection and its notes" do
      sign_in_with_google
      old = ada.collections.create!(name: "Old")
      note_in(old, title: "One", status: "archived")
      note_in(old, title: "Two", status: "archived")
      token = csrf_token

      expect { delete "/api/collections/#{old.id}", headers: { "X-CSRF-Token" => token } }
        .not_to change { [ Collection.count, Note.count ] }

      expect(response).to have_http_status(:conflict)
      expect(json_body).to eq("error" => "collection_not_empty")
      expect(ada.notes.pluck(:status)).to eq([ "archived", "archived" ])
    end

    it "AC-07 deleting a collection with no notes answers 204 and removes it" do
      sign_in_with_google
      spare = ada.collections.create!(name: "Spare")
      token = csrf_token

      delete "/api/collections/#{spare.id}", headers: { "X-CSRF-Token" => token }

      expect(response).to have_http_status(:no_content)
      expect(response.body).to be_empty
      expect(Collection.exists?(spare.id)).to be false
    end

    it "AC-07 a collection refused for its notes is deleted with 204 once its last note is deleted" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      note = note_in(work)
      token = csrf_token

      delete "/api/collections/#{work.id}", headers: { "X-CSRF-Token" => token }
      expect(response).to have_http_status(:conflict)

      delete "/api/notes/#{note.id}", headers: { "X-CSRF-Token" => token }
      expect(response).to have_http_status(:no_content)

      delete "/api/collections/#{work.id}", headers: { "X-CSRF-Token" => token }
      expect(response).to have_http_status(:no_content)
      expect(Collection.exists?(work.id)).to be false
    end

    it "AC-07 deleting a collection with notes with no sign-in answers 401 with or without a token and changes nothing" do
      work = grace.collections.create!(name: "Work")
      note_in(work)
      # This browser's own token, from a session with no sign-in.
      token = csrf_token

      [ {}, { "X-CSRF-Token" => token } ].each do |headers|
        expect { delete "/api/collections/#{work.id}", headers: headers }
          .not_to change { [ Collection.count, Note.count ] }

        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")
      end
    end

    it "AC-07 deleting a collection with notes without this session's anti-forgery token answers 403 and changes nothing" do
      # A token that another browser's session got is not this session's token.
      other_token = csrf_token(open_session)
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      note_in(work)

      [ {}, { "X-CSRF-Token" => other_token } ].each do |headers|
        expect { delete "/api/collections/#{work.id}", headers: headers }
          .not_to change { [ Collection.count, Note.count ] }

        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")
      end
    end

    it "AC-07 deleting another user's or a missing collection answers 404, never 409, and changes nothing" do
      secret = grace.collections.create!(name: "Secret")
      note_in(secret)
      gone = grace.collections.create!(name: "Gone").tap(&:destroy!)
      sign_in_with_google
      token = csrf_token

      [ secret.id, gone.id ].each do |id|
        expect { delete "/api/collections/#{id}", headers: { "X-CSRF-Token" => token } }
          .not_to change { [ Collection.count, Note.count ] }

        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")
      end
    end

    it "AC-07 a note saved in the collection just before its delete makes the delete answer 409 and keeps the note" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      token = csrf_token
      # A note is saved after the request has found the collection and before its
      # delete runs. The foreign key then refuses the delete.
      allow_any_instance_of(Collection).to receive(:destroy!).and_wrap_original do |original, *args|
        note_in(work, title: "Saved in the race")
        original.call(*args)
      end

      expect { delete "/api/collections/#{work.id}", headers: { "X-CSRF-Token" => token } }
        .to change { Note.count }.by(1)

      expect(response).to have_http_status(:conflict)
      expect(json_body).to eq("error" => "collection_not_empty")
      expect(Collection.exists?(work.id)).to be true
    end
  end
end

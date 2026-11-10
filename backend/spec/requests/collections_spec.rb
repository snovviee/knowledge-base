require "rails_helper"

# features/06_collections_crud. A browser signs in through the real callback, and a
# request that changes data sends this session's anti-forgery token, as the app
# does (sign_in_with_google and csrf_token: spec/support/request_helpers.rb).
RSpec.describe "Collections", type: :request do
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

  describe "GET /api/collections" do
    it "AC-06 GET /api/collections lists only the signed-in user's collections in alphabetical order" do
      sign_in_with_google
      %w[Work books Art].each { |name| ada.collections.create!(name: name) }
      grace.collections.create!(name: "Secret")

      get "/api/collections"

      expect(response).to have_http_status(:ok)
      expect(json_body["collections"].map { |collection| collection["name"] }).to eq(%w[Art books Work])
      expect(json_body["collections"].first).to eq("id" => ada.collections.find_by!(name: "Art").id, "name" => "Art")
    end

    it "AC-06 GET /api/collections answers 401 when no one is signed in" do
      get "/api/collections"

      expect(response).to have_http_status(:unauthorized)
      expect(json_body).to eq("error" => "unauthenticated")

      # A sign-in that has ended (a logout deletes it, features/05_logout) counts as no one.
      sign_in_with_google
      SignIn.delete_all
      get "/api/collections"

      expect(response).to have_http_status(:unauthorized)
      expect(json_body).to eq("error" => "unauthenticated")
    end
  end

  describe "POST /api/collections" do
    # Creates a collection as the app does: a JSON body and this session's token.
    def create_collection(name)
      post "/api/collections", params: { name: name }, headers: { "X-CSRF-Token" => csrf_token }, as: :json
    end

    it "AC-06 POST /api/collections creates a collection and answers 201 with it" do
      sign_in_with_google
      # Names are unique per user only, so another user's "Work notes" does not count.
      grace.collections.create!(name: "Work notes")

      expect { create_collection("  Work   notes  ") }.to change { ada.collections.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_body).to eq("collection" => { "id" => ada.collections.last.id, "name" => "Work notes" })
    end

    it "AC-06 POST /api/collections refuses a blank, too long, or taken name with 422 and the field code" do
      sign_in_with_google
      ada.collections.create!(name: "Работа")

      { "" => "blank", "   " => "blank", "a" * 101 => "too_long", " РАБОТА " => "taken" }.each do |name, code|
        expect { create_collection(name) }.not_to change(Collection, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => code })
      end
    end

    it "AC-06 POST /api/collections treats a missing or non-text name as blank" do
      sign_in_with_google
      token = csrf_token

      [ {}, { name: nil }, { name: 42 }, { name: [ "Work" ] }, { name: { text: "Work" } } ].each do |body|
        expect {
          post "/api/collections", params: body, headers: { "X-CSRF-Token" => token }, as: :json
        }.not_to change(Collection, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => "blank" })
      end
    end

    it "AC-06 a create that loses a race for the same name answers 422 taken" do
      sign_in_with_google
      token = csrf_token
      # Another request created "Work" after this request's check had passed. The
      # check is skipped here, so the database refuses the second row.
      ada.collections.create!(name: "Work")
      allow_any_instance_of(Collection).to receive(:valid?).and_return(true)

      post "/api/collections", params: { name: "work" }, headers: { "X-CSRF-Token" => token }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => "taken" })
      expect(ada.collections.pluck(:name)).to eq([ "Work" ])
    end
  end

  describe "PATCH /api/collections/:id" do
    def rename_collection(id, name, token: csrf_token)
      patch "/api/collections/#{id}", params: { name: name }, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-06 PATCH /api/collections/:id renames the collection and answers 200 with it" do
      sign_in_with_google
      work = ada.collections.create!(name: "work")

      rename_collection(work.id, "  Agenda  ")

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("collection" => { "id" => work.id, "name" => "Agenda" })
      expect(work.reload.name).to eq("Agenda")

      # A change of case only, and the same name again, are accepted.
      rename_collection(work.id, "AGENDA")
      expect(response).to have_http_status(:ok)
      expect(work.reload.name).to eq("AGENDA")
      rename_collection(work.id, "AGENDA")
      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("collection" => { "id" => work.id, "name" => "AGENDA" })
    end

    it "AC-06 PATCH /api/collections/:id refuses an invalid name with 422 and keeps the name" do
      sign_in_with_google
      home = ada.collections.create!(name: "Home")
      ada.collections.create!(name: "Work")
      token = csrf_token

      { "  " => "blank", 42 => "blank", "a" * 101 => "too_long", "WORK" => "taken" }.each do |name, code|
        rename_collection(home.id, name, token: token)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => code })
        expect(home.reload.name).to eq("Home")
      end
    end

    it "AC-06 a rename that loses a race for the same name answers 422 taken" do
      sign_in_with_google
      token = csrf_token
      art = ada.collections.create!(name: "Art")
      home = ada.collections.create!(name: "Home")

      # The first rename wins.
      rename_collection(art.id, "Work", token: token)
      expect(response).to have_http_status(:ok)

      # The second rename's check ran before the first one was saved, so it passed.
      # The check is skipped here, so the database refuses the row.
      allow_any_instance_of(Collection).to receive(:valid?).and_return(true)
      rename_collection(home.id, "work", token: token)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => "taken" })
      expect(home.reload.name).to eq("Home")
      expect(art.reload.name).to eq("Work")
    end
  end

  describe "DELETE /api/collections/:id" do
    it "AC-06 DELETE /api/collections/:id deletes the collection and answers 204" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      ada.collections.create!(name: "Home")

      delete "/api/collections/#{work.id}", headers: { "X-CSRF-Token" => csrf_token }

      expect(response).to have_http_status(:no_content)
      expect(response.body).to be_empty
      get "/api/collections"
      expect(json_body["collections"].map { |collection| collection["name"] }).to eq([ "Home" ])
    end
  end

  describe "another user's or a missing collection" do
    it "AC-06 renaming or deleting another user's or a missing collection answers 404 and changes nothing" do
      secret = grace.collections.create!(name: "Secret")
      gone = grace.collections.create!(name: "Gone").tap(&:destroy!)
      sign_in_with_google
      token = csrf_token

      [ secret.id, gone.id, "not-a-number" ].each do |id|
        patch "/api/collections/#{id}", params: { name: "Hacked" }, headers: { "X-CSRF-Token" => token }, as: :json
        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")

        delete "/api/collections/#{id}", headers: { "X-CSRF-Token" => token }
        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")
      end

      expect(secret.reload.name).to eq("Secret")
    end
  end

  describe "the anti-forgery token" do
    it "AC-06 create, rename, and delete without this session's anti-forgery token answer 403 and change nothing" do
      # A token that another browser's session got is not this session's token.
      other_token = csrf_token(open_session)
      sign_in_with_google
      work = ada.collections.create!(name: "Work")

      [ {}, { "X-CSRF-Token" => other_token } ].each do |headers|
        post "/api/collections", params: { name: "New" }, headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")

        patch "/api/collections/#{work.id}", params: { name: "Renamed" }, headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")

        delete "/api/collections/#{work.id}", headers: headers
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")
      end

      expect(ada.collections.pluck(:name)).to eq([ "Work" ])
    end
  end

  describe "no sign-in" do
    it "AC-06 create, rename, and delete with no sign-in answer 401 with or without a token" do
      work = grace.collections.create!(name: "Work")
      # This browser's own token, from a session with no sign-in.
      token = csrf_token

      [ {}, { "X-CSRF-Token" => token } ].each do |headers|
        post "/api/collections", params: { name: "New" }, headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")

        patch "/api/collections/#{work.id}", params: { name: "Renamed" }, headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")

        delete "/api/collections/#{work.id}", headers: headers
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")
      end

      expect(Collection.pluck(:name)).to eq([ "Work" ])
    end
  end

  describe "a body that is not JSON" do
    it "AC-06 a collections request whose body is not valid JSON answers 400" do
      sign_in_with_google
      work = ada.collections.create!(name: "Work")
      headers = { "X-CSRF-Token" => csrf_token, "Content-Type" => "application/json" }

      post "/api/collections", params: '{"name": "Half', headers: headers
      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      patch "/api/collections/#{work.id}", params: "{", headers: headers
      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      expect(ada.collections.pluck(:name)).to eq([ "Work" ])
    end
  end
end

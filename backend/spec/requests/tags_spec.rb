require "rails_helper"

# features/08_tags_crud. A browser signs in through the real callback, and a request
# that changes data sends this session's anti-forgery token, as the app does
# (sign_in_with_google and csrf_token: spec/support/request_helpers.rb).
RSpec.describe "Tags", type: :request do
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

  describe "GET /api/tags" do
    it "AC-08 GET /api/tags lists only the signed-in user's tags in alphabetical order" do
      sign_in_with_google
      %w[rails Books art].each { |name| ada.tags.create!(name: name) }
      grace.tags.create!(name: "secret")

      get "/api/tags"

      expect(response).to have_http_status(:ok)
      expect(json_body["tags"].map { |tag| tag["name"] }).to eq(%w[art Books rails])
      expect(json_body["tags"].first).to eq("id" => ada.tags.find_by!(name: "art").id, "name" => "art")
    end
  end

  describe "POST /api/tags" do
    # Creates a tag as the app does: a JSON body and this session's token.
    def create_tag(name, token: csrf_token)
      post "/api/tags", params: { name: name }, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-08 POST /api/tags creates a tag and answers 201 with it" do
      sign_in_with_google
      token = csrf_token
      # Names are unique among the user's tags only, so another user's "work" and the
      # user's own collection "Work" do not count.
      grace.tags.create!(name: "work")
      ada.collections.create!(name: "Work")

      expect { create_tag("  machine   learning  ", token: token) }.to change { ada.tags.count }.by(1)

      expect(response).to have_http_status(:created)
      expect(json_body).to eq("tag" => { "id" => ada.tags.last.id, "name" => "machine learning" })

      # Any characters (spec question 3).
      [ "work", "#work", "C#" ].each do |name|
        create_tag(name, token: token)
        expect(response).to have_http_status(:created)
        expect(json_body["tag"]["name"]).to eq(name)
      end
      expect(ada.tags.alphabetical.pluck(:name)).to eq([ "#work", "C#", "machine learning", "work" ])
    end

    it "AC-08 POST /api/tags refuses a blank, too long, or taken name with 422 and the field code" do
      sign_in_with_google
      token = csrf_token
      ada.tags.create!(name: "Работа")

      { "" => "blank", "   " => "blank", "t" * 101 => "too_long", " РАБОТА " => "taken" }.each do |name, code|
        expect { create_tag(name, token: token) }.not_to change(Tag, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => code })
      end
    end

    it "AC-08 POST /api/tags treats a missing or non-text name as blank" do
      sign_in_with_google
      token = csrf_token

      [ {}, { name: nil }, { name: 42 }, { name: [ "work" ] }, { name: { text: "work" } } ].each do |body|
        expect {
          post "/api/tags", params: body, headers: { "X-CSRF-Token" => token }, as: :json
        }.not_to change(Tag, :count)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => "blank" })
      end
    end

    it "AC-08 a tag create that loses a race for the same name answers 422 taken" do
      sign_in_with_google
      token = csrf_token
      # Another request created "work" after this request's check had passed. The
      # check is skipped here, so the database refuses the second row.
      ada.tags.create!(name: "work")
      allow_any_instance_of(Tag).to receive(:valid?).and_return(true)

      create_tag("WORK", token: token)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => "taken" })
      expect(ada.tags.pluck(:name)).to eq([ "work" ])
    end
  end

  describe "PATCH /api/tags/:id" do
    def rename_tag(id, name, token: csrf_token)
      patch "/api/tags/#{id}", params: { name: name }, headers: { "X-CSRF-Token" => token }, as: :json
    end

    it "AC-08 PATCH /api/tags/:id renames the tag and answers 200 with it" do
      sign_in_with_google
      token = csrf_token
      work = ada.tags.create!(name: "work")

      rename_tag(work.id, "  agenda  ", token: token)

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("tag" => { "id" => work.id, "name" => "agenda" })
      expect(work.reload.name).to eq("agenda")

      # A change of case only, and the same name again, are accepted.
      rename_tag(work.id, "Agenda", token: token)
      expect(response).to have_http_status(:ok)
      expect(work.reload.name).to eq("Agenda")
      rename_tag(work.id, "Agenda", token: token)
      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("tag" => { "id" => work.id, "name" => "Agenda" })
    end

    it "AC-08 PATCH /api/tags/:id refuses an invalid name with 422 and keeps the name" do
      sign_in_with_google
      home = ada.tags.create!(name: "home")
      ada.tags.create!(name: "work")
      token = csrf_token

      { "  " => "blank", 42 => "blank", "t" * 101 => "too_long", "WORK" => "taken" }.each do |name, code|
        rename_tag(home.id, name, token: token)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => code })
        expect(home.reload.name).to eq("home")
      end
    end

    it "AC-08 a tag rename that loses a race for the same name answers 422 taken" do
      sign_in_with_google
      token = csrf_token
      art = ada.tags.create!(name: "art")
      home = ada.tags.create!(name: "home")

      # The first rename wins.
      rename_tag(art.id, "work", token: token)
      expect(response).to have_http_status(:ok)

      # The second rename's check ran before the first one was saved, so it passed.
      # The check is skipped here, so the database refuses the row.
      allow_any_instance_of(Tag).to receive(:valid?).and_return(true)
      rename_tag(home.id, "Work", token: token)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body).to eq("error" => "validation_failed", "fields" => { "name" => "taken" })
      expect(home.reload.name).to eq("home")
      expect(art.reload.name).to eq("work")
    end
  end

  describe "DELETE /api/tags/:id" do
    it "AC-08 DELETE /api/tags/:id deletes the tag and answers 204" do
      sign_in_with_google
      work = ada.tags.create!(name: "work")
      ada.tags.create!(name: "home")

      delete "/api/tags/#{work.id}", headers: { "X-CSRF-Token" => csrf_token }

      expect(response).to have_http_status(:no_content)
      expect(response.body).to be_empty
      get "/api/tags"
      expect(json_body["tags"].map { |tag| tag["name"] }).to eq([ "home" ])
    end
  end

  describe "another user's or a missing tag" do
    it "AC-08 renaming or deleting another user's or a missing tag answers 404 and changes nothing" do
      secret = grace.tags.create!(name: "secret")
      gone = grace.tags.create!(name: "gone").tap(&:destroy!)
      sign_in_with_google
      token = csrf_token

      [ secret.id, gone.id, "not-a-number" ].each do |id|
        patch "/api/tags/#{id}", params: { name: "hacked" }, headers: { "X-CSRF-Token" => token }, as: :json
        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")

        delete "/api/tags/#{id}", headers: { "X-CSRF-Token" => token }
        expect(response).to have_http_status(:not_found)
        expect(json_body).to eq("error" => "not_found")
      end

      expect(secret.reload.name).to eq("secret")
    end
  end

  describe "a body that is not JSON" do
    it "AC-08 a tags request whose body is not valid JSON answers 400" do
      sign_in_with_google
      work = ada.tags.create!(name: "work")
      headers = { "X-CSRF-Token" => csrf_token, "Content-Type" => "application/json" }

      post "/api/tags", params: '{"name": "Half', headers: headers
      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      patch "/api/tags/#{work.id}", params: "{", headers: headers
      expect(response).to have_http_status(:bad_request)
      expect(json_body).to eq("error" => "bad_request")

      expect(ada.tags.pluck(:name)).to eq([ "work" ])
    end
  end

  describe "the anti-forgery token" do
    it "AC-08 tag create, rename, and delete without this session's anti-forgery token answer 403 and change nothing" do
      # A token that another browser's session got is not this session's token.
      other_token = csrf_token(open_session)
      sign_in_with_google
      work = ada.tags.create!(name: "work")

      [ {}, { "X-CSRF-Token" => other_token } ].each do |headers|
        post "/api/tags", params: { name: "new" }, headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")

        patch "/api/tags/#{work.id}", params: { name: "renamed" }, headers: headers, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")

        delete "/api/tags/#{work.id}", headers: headers
        expect(response).to have_http_status(:forbidden)
        expect(json_body).to eq("error" => "invalid_csrf_token")
      end

      expect(ada.tags.pluck(:name)).to eq([ "work" ])
    end
  end

  describe "no sign-in" do
    it "AC-08 the tags requests answer 401 with no sign-in, with or without a token" do
      work = grace.tags.create!(name: "work")
      # This browser's own token, from a session with no sign-in.
      token = csrf_token

      get "/api/tags"
      expect(response).to have_http_status(:unauthorized)
      expect(json_body).to eq("error" => "unauthenticated")

      [ {}, { "X-CSRF-Token" => token } ].each do |headers|
        post "/api/tags", params: { name: "new" }, headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")

        patch "/api/tags/#{work.id}", params: { name: "renamed" }, headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")

        delete "/api/tags/#{work.id}", headers: headers
        expect(response).to have_http_status(:unauthorized)
        expect(json_body).to eq("error" => "unauthenticated")
      end

      # A sign-in that has ended (a logout deletes it, features/05_logout) counts as no one.
      sign_in_with_google
      SignIn.delete_all
      get "/api/tags"
      expect(response).to have_http_status(:unauthorized)
      expect(json_body).to eq("error" => "unauthenticated")

      expect(Tag.pluck(:name)).to eq([ "work" ])
    end
  end
end

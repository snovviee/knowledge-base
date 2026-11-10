require "rails_helper"

# features/05_logout. Each sign-in is recorded for its browser, and logout deletes
# that record, so the session cookie of a logged-out browser signs no one in.
#
# sign_in_with_google and csrf_token come from spec/support/request_helpers.rb.
RSpec.describe "Logout", type: :request do
  describe "sign-in" do
    it "AC-05 a successful sign-in records a live sign-in for this browser" do
      expect { sign_in_with_google }.to change(SignIn, :count).by(1)

      sign_in = SignIn.last
      expect(sign_in.user).to eq(User.find_by!(provider: "google_oauth2", provider_user_id: "u-1"))
      expect(session[:sign_in_token]).to eq(sign_in.token)
    end
  end

  describe "GET /api/session" do
    it "AC-05 GET /api/session returns 401 once the session's sign-in has ended" do
      sign_in_with_google
      get "/api/session"
      expect(response).to have_http_status(:ok)

      SignIn.delete_all
      get "/api/session"

      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)).to eq("error" => "unauthenticated")
    end
  end

  describe "DELETE /api/session" do
    it "AC-05 logging out answers 204 and GET /api/session then returns 401" do
      sign_in_with_google

      delete "/api/session", headers: { "X-CSRF-Token" => csrf_token }

      expect(response).to have_http_status(:no_content)
      expect(response.body).to be_empty

      get "/api/session"
      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)).to eq("error" => "unauthenticated")
    end

    it "AC-05 a copy of the session cookie kept from before logout does not sign the user back in" do
      sign_in_with_google
      token = csrf_token
      kept_cookie = cookies["_knowledge_base_session"]

      delete "/api/session", headers: { "X-CSRF-Token" => token }
      expect(response).to have_http_status(:no_content)

      # Someone who copied the cookie before the logout sends it again.
      cookies["_knowledge_base_session"] = kept_cookie
      get "/api/session"

      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)).to eq("error" => "unauthenticated")
    end

    it "AC-05 logging out in one browser keeps the user signed in in another browser" do
      # A second browser has its own cookies. Both sign in as the same Google account.
      other_browser = open_session
      sign_in_with_google
      sign_in_with_google(other_browser)

      delete "/api/session", headers: { "X-CSRF-Token" => csrf_token }
      expect(response).to have_http_status(:no_content)

      other_browser.get "/api/session"
      expect(other_browser.response).to have_http_status(:ok)
      expect(JSON.parse(other_browser.response.body)["user"]["display_name"]).to eq("Ada Lovelace")
    end

    it "AC-05 refuses a logout without this session's anti-forgery token with 403 and keeps the user signed in" do
      # A token that another browser's session got is not this session's token.
      other_browser = open_session
      other_browser.get "/api/csrf"
      other_token = JSON.parse(other_browser.response.body)["token"]
      sign_in_with_google

      delete "/api/session"
      expect(response).to have_http_status(:forbidden)
      expect(JSON.parse(response.body)).to eq("error" => "invalid_csrf_token")

      delete "/api/session", headers: { "X-CSRF-Token" => other_token }
      expect(response).to have_http_status(:forbidden)
      expect(JSON.parse(response.body)).to eq("error" => "invalid_csrf_token")

      get "/api/session"
      expect(response).to have_http_status(:ok)
    end

    it "AC-05 a logout when no one is signed in answers 204 without a token and ends no other sign-in" do
      # The user is signed in in another browser. This browser has no sign-in.
      other_browser = open_session
      sign_in_with_google(other_browser)

      delete "/api/session"

      expect(response).to have_http_status(:no_content)
      expect(response.body).to be_empty
      other_browser.get "/api/session"
      expect(other_browser.response).to have_http_status(:ok)
    end
  end
end

# Helpers for request specs (features/05_logout, features/06_collections_crud).
module RequestHelpers
  # Signs in through the real Google callback (OmniAuth test mode), so the session
  # is set as the app sets it. A browser from open_session has its own cookies. A
  # second user signs in with another uid.
  def sign_in_with_google(browser = integration_session, uid: "u-1", name: "Ada Lovelace")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2", uid: uid, info: { name: name }
    )
    browser.get "/auth/google_oauth2/callback"
  end

  # The browser's anti-forgery token, as the app gets it right before a request that
  # changes data. Every non-GET API request sends it in X-CSRF-Token.
  def csrf_token(browser = integration_session)
    browser.get "/api/csrf"
    JSON.parse(browser.response.body)["token"]
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end

# Google sign-in (features/01_google_sign_in). Credentials come from the environment (see README).
#
# The Google strategy refuses to build a redirect without a client id. Tests run
# without real credentials, so they get placeholders here. No test sends them to
# Google: test mode, or a mocked callback, handles every request.
google_client_id = ENV["GOOGLE_CLIENT_ID"].presence || ("test-google-client-id" if Rails.env.test?)
google_client_secret = ENV["GOOGLE_CLIENT_SECRET"].presence || ("test-google-client-secret" if Rails.env.test?)

# Callback URLs are built from this host, not from the request's Host header, which
# a client can forge. Local development uses localhost:3000 (README).
OmniAuth.config.full_host = ENV.fetch("APP_BASE_URL", "http://localhost:3000")

Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2,
    google_client_id,
    google_client_secret,
    scope: "email,profile"
end

# A refused token, a cancelled sign-in, and a failed sign-in all end here, with
# the same message. The provider's error text is not passed on.
OmniAuth.config.on_failure = lambda do |_env|
  [ 302, { "location" => "/?sign_in_error=google" }, [] ]
end

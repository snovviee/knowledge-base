# Google sign-in (features/01_google_sign_in). Credentials come from the environment (see README).
#
# The Google strategy refuses to build a redirect without a client id. Tests run
# without real credentials, so they get placeholders here. No test sends them to
# Google: test mode, or a mocked callback, handles every request.
google_client_id = ENV["GOOGLE_CLIENT_ID"].presence || ("test-google-client-id" if Rails.env.test?)
google_client_secret = ENV["GOOGLE_CLIENT_SECRET"].presence || ("test-google-client-secret" if Rails.env.test?)

# GitHub sign-in (features/02_github_sign_in). Same rules as Google above.
github_client_id = ENV["GITHUB_CLIENT_ID"].presence || ("test-github-client-id" if Rails.env.test?)
github_client_secret = ENV["GITHUB_CLIENT_SECRET"].presence || ("test-github-client-secret" if Rails.env.test?)

# Callback URLs are built from this host, not from the request's Host header, which
# a client can forge. Local development uses localhost:3000 (README).
OmniAuth.config.full_host = ENV.fetch("APP_BASE_URL", "http://localhost:3000")

Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2,
    google_client_id,
    google_client_secret,
    scope: "email,profile"

  # user:email lets the strategy read the verified primary email. Without it GitHub
  # sends no email, which the spec allows (features/02_github_sign_in question 2).
  provider :github,
    github_client_id,
    github_client_secret,
    scope: "user:email"
end

# A refused token, a cancelled sign-in, and a failed sign-in all end here, with the
# same message for that provider. The provider's error text is not passed on. The
# name comes from the failed strategy, so GitHub failures name GitHub
# (features/02_github_sign_in). Unknown or missing strategies fall back to "google".
#
# The strategy's name is OmniAuth's (google_oauth2), and the address uses the short
# provider name the screen knows (google, github).
SIGN_IN_ERROR_PROVIDERS = { "google_oauth2" => "google", "github" => "github" }.freeze

OmniAuth.config.on_failure = lambda do |env|
  strategy = env["omniauth.error.strategy"]
  name = strategy.respond_to?(:name) ? strategy.name.to_s : nil
  provider = SIGN_IN_ERROR_PROVIDERS.fetch(name, "google")
  [ 302, { "location" => "/?sign_in_error=#{provider}" }, [] ]
end

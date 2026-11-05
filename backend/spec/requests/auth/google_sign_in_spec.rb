require "rails_helper"

RSpec.describe "Google sign-in", type: :request do
  describe "sign-in start" do
    # OmniAuth's test mode returns before its phases run, and the CSRF check is a
    # phase. So this example turns test mode off, and forgery protection on, to
    # run the real token check of omniauth-rails_csrf_protection.
    around do |example|
      OmniAuth.config.test_mode = false
      ActionController::Base.allow_forgery_protection = true
      example.run
    ensure
      OmniAuth.config.test_mode = true
      ActionController::Base.allow_forgery_protection = false
    end

    it "AC-01 refuses a sign-in start without the CSRF token, so no redirect to Google happens" do
      post "/auth/google_oauth2"

      expect(response).to have_http_status(:found)
      expect(response.location).to eq("/?sign_in_error=google")
      expect(response.location).not_to include("accounts.google.com")
    end
  end

  describe "state check" do
    # The state check runs in the callback phase, which only runs with test mode
    # off. This `before` runs after spec/support/omniauth.rb sets test mode on,
    # so it wins. An `around` block would be overwritten by that hook.
    before do
      OmniAuth.config.test_mode = false
    end

    after do
      OmniAuth.config.test_mode = true
    end

    it "AC-01 rejects a callback whose state does not match the sign-in started in this browser" do
      # Start a real sign-in in this session. It stores the state that Google must echo back.
      post "/auth/google_oauth2"
      expect(response.location).to include("accounts.google.com")

      # The state check runs before the token exchange with Google. The exchange
      # must not run at all, so a forged callback reaches Google with no token request.
      expect_any_instance_of(OmniAuth::Strategies::GoogleOauth2).not_to receive(:fetch_access_token)

      expect {
        get "/auth/google_oauth2/callback", params: { code: "anything", state: "forged-state" }
      }.not_to change(User, :count)

      expect(response).to redirect_to("/?sign_in_error=google")
      expect(session[:user_id]).to be_nil
    end
  end

  describe "callback" do
    before do
      OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
        provider: "google_oauth2",
        uid: "google-uid-1",
        info: { name: "Ada Lovelace", email: "ada@example.com", image: "https://example.com/ada.png" }
      )
    end

    it "AC-01 first Google sign-in creates the user record and signs the user in" do
      expect { get "/auth/google_oauth2/callback" }.to change(User, :count).by(1)

      expect(response).to redirect_to("/")
      user = User.last
      expect(user.provider).to eq("google_oauth2")
      expect(user.provider_user_id).to eq("google-uid-1")
      expect(user.display_name).to eq("Ada Lovelace")
      expect(session[:user_id]).to eq(user.id)
    end

    it "AC-01 a repeat Google sign-in signs in the same user and creates no second record" do
      get "/auth/google_oauth2/callback"
      first_id = User.last.id

      expect { get "/auth/google_oauth2/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/")
      expect(session[:user_id]).to eq(first_id)
    end

    it "AC-01 a changed Google email still signs in the same user" do
      get "/auth/google_oauth2/callback"
      first_id = User.last.id

      OmniAuth.config.mock_auth[:google_oauth2].info.email = "ada.new@example.com"
      expect { get "/auth/google_oauth2/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/")
      expect(session[:user_id]).to eq(first_id)
    end

    it "AC-01 a sign-in cancelled at Google signs nobody in and redirects with the sign-in error" do
      OmniAuth.config.mock_auth[:google_oauth2] = :access_denied

      expect { get "/auth/google_oauth2/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/?sign_in_error=google")
      expect(session[:user_id]).to be_nil
    end

    it "AC-01 a failed Google sign-in signs nobody in and redirects with the same sign-in error" do
      OmniAuth.config.mock_auth[:google_oauth2] = :invalid_credentials

      expect { get "/auth/google_oauth2/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/?sign_in_error=google")
      expect(session[:user_id]).to be_nil
    end

    it "AC-01 a Google sign-in that cannot reach Google redirects with the same sign-in error" do
      OmniAuth.config.mock_auth[:google_oauth2] = :timeout

      expect { get "/auth/google_oauth2/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/?sign_in_error=google")
      expect(session[:user_id]).to be_nil
    end

    it "AC-01 a Google sign-in without an email stores the user without an email" do
      OmniAuth.config.mock_auth[:google_oauth2].info.email = nil

      get "/auth/google_oauth2/callback"

      expect(response).to redirect_to("/")
      expect(User.last.email).to be_nil
    end

    it "AC-01 the request log of a Google callback does not contain the OAuth code or state" do
      # Capture what Rails writes for this request. The code and state are sent by
      # Google, and they must not be stored in the log.
      log = StringIO.new
      original_logger = Rails.logger
      Rails.logger = ActiveSupport::Logger.new(log)
      begin
        get "/auth/google_oauth2/callback", params: { code: "secret-oauth-code", state: "secret-oauth-state" }
      ensure
        Rails.logger = original_logger
      end

      # The request line itself carries the query string, so it must be filtered too.
      expect(log.string).to include("Started GET")
      expect(log.string).not_to include("secret-oauth-code")
      expect(log.string).not_to include("secret-oauth-state")
    end
  end
end

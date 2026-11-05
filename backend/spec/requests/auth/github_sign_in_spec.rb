require "rails_helper"

RSpec.describe "GitHub sign-in", type: :request do
  describe "callback" do
    before do
      OmniAuth.config.mock_auth[:github] = OmniAuth::AuthHash.new(
        provider: "github",
        uid: "4242",
        info: { name: "Grace Hopper", nickname: "gracehopper", email: "grace@example.com",
                image: "https://example.com/grace.png" }
      )
    end

    it "AC-02 first GitHub sign-in creates the user record and signs the user in" do
      expect { get "/auth/github/callback" }.to change(User, :count).by(1)

      expect(response).to redirect_to("/")
      user = User.last
      expect(user.provider).to eq("github")
      expect(user.provider_user_id).to eq("4242")
      expect(user.display_name).to eq("Grace Hopper")
      expect(session[:user_id]).to eq(user.id)
    end

    it "AC-02 a repeat GitHub sign-in signs in the same user and creates no second record" do
      get "/auth/github/callback"
      first_id = User.last.id

      expect { get "/auth/github/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/")
      expect(session[:user_id]).to eq(first_id)
    end

    it "AC-02 the request log of a GitHub callback does not contain the OAuth code or state" do
      log = StringIO.new
      original_logger = Rails.logger
      Rails.logger = ActiveSupport::Logger.new(log)
      begin
        get "/auth/github/callback", params: { code: "secret-github-code", state: "secret-github-state" }
      ensure
        Rails.logger = original_logger
      end

      expect(log.string).to include("Started GET")
      expect(log.string).not_to include("secret-github-code")
      expect(log.string).not_to include("secret-github-state")
    end

    it "AC-02 a GitHub account with no public name uses its login as the display name" do
      OmniAuth.config.mock_auth[:github].info.name = nil

      get "/auth/github/callback"

      expect(response).to redirect_to("/")
      expect(User.last.display_name).to eq("gracehopper")
    end

    it "AC-02 a GitHub account with no email signs in and stores the user without an email" do
      OmniAuth.config.mock_auth[:github].info.email = nil

      get "/auth/github/callback"

      expect(response).to redirect_to("/")
      expect(User.last.email).to be_nil
    end

    it "AC-02 a changed GitHub email still signs in the same user" do
      get "/auth/github/callback"
      first_id = User.last.id

      OmniAuth.config.mock_auth[:github].info.email = "grace.new@example.com"
      expect { get "/auth/github/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/")
      expect(session[:user_id]).to eq(first_id)
    end

    it "AC-02 a Google user and a GitHub user with the same email are two separate users" do
      User.create!(provider: "google_oauth2", provider_user_id: "g-1", display_name: "Grace (Google)",
                   email: "grace@example.com")

      expect { get "/auth/github/callback" }.to change(User, :count).by(1)

      expect(User.where(email: "grace@example.com").count).to eq(2)
      expect(User.find(session[:user_id]).provider).to eq("github")
    end

    it "AC-02 a GitHub sign-in cancelled at GitHub redirects with the GitHub sign-in error" do
      OmniAuth.config.mock_auth[:github] = :access_denied

      expect { get "/auth/github/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/?sign_in_error=github")
      expect(session[:user_id]).to be_nil
    end

    it "AC-02 a failed GitHub sign-in signs nobody in and redirects with the GitHub sign-in error" do
      OmniAuth.config.mock_auth[:github] = :invalid_credentials

      expect { get "/auth/github/callback" }.not_to change(User, :count)

      expect(response).to redirect_to("/?sign_in_error=github")
      expect(session[:user_id]).to be_nil
    end

    it "AC-02 a failure from GitHub redirects with the provider name github" do
      OmniAuth.config.mock_auth[:github] = :timeout

      get "/auth/github/callback"

      expect(response).to redirect_to("/?sign_in_error=github")
    end
  end

  describe "state check" do
    # The state check runs in the callback phase, which only runs with test mode
    # off. This `before` runs after spec/support/omniauth.rb sets test mode on.
    before do
      OmniAuth.config.test_mode = false
    end

    after do
      OmniAuth.config.test_mode = true
    end

    it "AC-02 rejects a GitHub callback whose state does not match the sign-in started in this browser" do
      post "/auth/github"
      expect(response.location).to include("github.com/login")

      expect_any_instance_of(OmniAuth::Strategies::GitHub).not_to receive(:fetch_access_token)

      expect {
        get "/auth/github/callback", params: { code: "anything", state: "forged-state" }
      }.not_to change(User, :count)

      expect(response).to redirect_to("/?sign_in_error=github")
      expect(session[:user_id]).to be_nil
    end
  end

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

    it "AC-02 refuses a GitHub sign-in start without the CSRF token, so no redirect to GitHub happens" do
      post "/auth/github"

      expect(response).to have_http_status(:found)
      expect(response.location).to eq("/?sign_in_error=github")
      expect(response.location).not_to include("github.com/login")
    end
  end
end

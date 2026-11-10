require "rails_helper"

RSpec.describe "GET /api/session", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  after { travel_back }

  # The expiry the last response set on the session cookie, or nil.
  def session_cookie_expiry
    line = Array(response.headers["Set-Cookie"]).join("\n").lines.find { |l| l.start_with?("_knowledge_base_session=") }
    expires = line && line[/expires=([^;]+)/i, 1]
    expires && Time.httpdate(expires)
  end

  it "AC-01 returns 401 when no user is signed in" do
    get "/api/session"

    expect(response).to have_http_status(:unauthorized)
    expect(JSON.parse(response.body)).to eq("error" => "unauthenticated")
  end

  it "AC-01 returns the signed-in user's display name" do
    user = User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada Lovelace")
    # Sign the user in through the real callback, so the session is set as the app sets it.
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2", uid: "u-1", info: { name: "Ada Lovelace" }
    )
    get "/auth/google_oauth2/callback"

    get "/api/session"

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["user"]).to eq("id" => user.id, "display_name" => "Ada Lovelace")
  end

  it "AC-04 a sign-in lasts until 30 days pass without a visit" do
    User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada Lovelace")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2", uid: "u-1", info: { name: "Ada Lovelace" }
    )

    get "/auth/google_oauth2/callback"
    expect(session_cookie_expiry).to be_within(1.minute).of(30.days.from_now)

    # A visit 20 days later renews the 30 days.
    travel 20.days
    get "/api/session"
    expect(response).to have_http_status(:ok)
    expect(session_cookie_expiry).to be_within(1.minute).of(30.days.from_now)

    # 25 days after that visit (45 after sign-in) the user is still signed in.
    travel 25.days
    get "/api/session"
    expect(response).to have_http_status(:ok)
    kept_cookie = cookies["_knowledge_base_session"]

    # 31 days without a visit: a client that kept the cookie anyway is refused.
    travel 31.days
    cookies["_knowledge_base_session"] = kept_cookie
    get "/api/session"
    expect(response).to have_http_status(:unauthorized)
    expect(JSON.parse(response.body)).to eq("error" => "unauthenticated")
  end
end

require "rails_helper"

RSpec.describe "GET /api/session", type: :request do
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
end

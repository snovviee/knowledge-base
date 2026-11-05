require "rails_helper"

RSpec.describe "GET /api/csrf", type: :request do
  it "AC-01 returns a token for the session" do
    get "/api/csrf"

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["token"]).to be_present
  end
end

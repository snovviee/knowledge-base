require "rails_helper"

RSpec.describe "Automatic user record on first SSO sign-in", type: :request do
  before do
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: "race-uid-1",
      info: { name: "Race Person", email: "race@example.com", image: "https://example.com/r.png" }
    )
  end

  it "AC-03 one record for one provider account" do
    get "/auth/google_oauth2/callback"
    expect { get "/auth/google_oauth2/callback" }.not_to change(User, :count)
    expect(User.where(provider: "google_oauth2", provider_user_id: "race-uid-1").count).to eq(1)
  end

  it "AC-03 a later sign-in with a changed name and avatar keeps the first values" do
    get "/auth/google_oauth2/callback"
    user = User.find_by!(provider: "google_oauth2", provider_user_id: "race-uid-1")
    expect(user.display_name).to eq("Race Person")

    OmniAuth.config.mock_auth[:google_oauth2].info.name = "Renamed Person"
    OmniAuth.config.mock_auth[:google_oauth2].info.image = "https://example.com/new.png"
    get "/auth/google_oauth2/callback"

    user.reload
    expect(user.display_name).to eq("Race Person")
    expect(user.avatar_url).to eq("https://example.com/r.png")
  end

  it "AC-03 a provider account with no usable name cannot be stored and redirects with the sign-in error" do
    # OmniAuth's InfoHash#name falls back in order: name, first and last name,
    # nickname, email. So a name is missing only when the account has none of those.
    # This mock has no name, no login, and no email.
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2",
      uid: "race-uid-1",
      info: { image: "https://example.com/r.png" }
    )

    expect { get "/auth/google_oauth2/callback" }.not_to change(User, :count)
    expect(response).to redirect_to("/?sign_in_error=google")
    expect(session[:user_id]).to be_nil
  end

  it "AC-03 a sign-in that loses a race to a second request for the same account still signs the user in" do
    # Another request creates the record after this request's lookup has already
    # missed. The lookup is stubbed to miss once, so this request reaches create.
    User.create!(provider: "google_oauth2", provider_user_id: "race-uid-1", display_name: "Other request")
    # Only the first lookup for this account misses, as if the other request had not
    # finished yet. The second lookup, after the duplicate create fails, finds the record.
    allow(User).to receive(:find_by).and_call_original
    allow(User).to receive(:find_by)
      .with(provider: "google_oauth2", provider_user_id: "race-uid-1")
      .and_return(nil, User.find_by(provider: "google_oauth2", provider_user_id: "race-uid-1"))

    get "/auth/google_oauth2/callback"

    # Today a lost race ends in a 422 (RecordInvalid, duplicate provider user).
    expect(response).to have_http_status(:found)
    expect(response).to redirect_to("/")
    expect(session[:user_id]).to eq(User.find_by!(provider: "google_oauth2", provider_user_id: "race-uid-1").id)
    expect(User.where(provider: "google_oauth2", provider_user_id: "race-uid-1").count).to eq(1)
  end
end

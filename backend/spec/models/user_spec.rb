require "rails_helper"

RSpec.describe User, type: :model do
  it "AC-01 identifies a user by provider and provider_user_id, unique together" do
    User.create!(provider: "google_oauth2", provider_user_id: "123", display_name: "Ada")

    duplicate = User.new(provider: "google_oauth2", provider_user_id: "123", display_name: "Ada again")
    expect(duplicate).not_to be_valid

    other_provider = User.new(provider: "github", provider_user_id: "123", display_name: "Ada on GitHub")
    expect(other_provider).to be_valid
  end
end

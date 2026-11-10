require "rails_helper"

RSpec.describe SignIn, type: :model do
  it "AC-05 a sign-in belongs to a user, gets its own random token, and is deleted with the user" do
    user = User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada")

    first = user.sign_ins.create!
    second = user.sign_ins.create!

    expect(first.token).to be_present
    expect(first.token.length).to be >= 24
    expect(second.token).not_to eq(first.token)
    expect(SignIn.new).not_to be_valid

    user.destroy
    expect(SignIn.count).to eq(0)
  end
end

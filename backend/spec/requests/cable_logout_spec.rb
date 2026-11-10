require "rails_helper"

# features/22_websocket_auth. Logout closes, at once, every open WebSocket connection of the
# sign-in it ends, and tells each not to reconnect. The same user's other browsers stay
# connected (spec question 4). Action Cable closes a sign-in's connections with a message
# broadcast on their internal channel, which the test adapter of config/cable.yml records.
#
# sign_in_with_google and csrf_token come from spec/support/request_helpers.rb, and
# internal_channel_of from spec/support/cable_helpers.rb.
RSpec.describe "Logout and the WebSocket connections", type: :request do
  it "AC-22 logout closes every open connection of this browser's sign-in and tells them not to reconnect" do
    sign_in_with_google
    sign_in = SignIn.sole
    token = csrf_token
    # The sign-in is deleted before its connections are closed, so a connection that opens
    # in between is refused.
    sign_in_existed_at_close = nil
    allow(ActionCable.server).to receive(:broadcast).and_wrap_original do |original, channel, message, **options|
      sign_in_existed_at_close = SignIn.exists?(sign_in.id) if channel == internal_channel_of(sign_in)
      original.call(channel, message, **options)
    end

    expect {
      delete "/api/session", headers: { "X-CSRF-Token" => token }
    }.to have_broadcasted_to(internal_channel_of(sign_in)).with(type: "disconnect", reconnect: false)

    expect(response).to have_http_status(:no_content)
    expect(sign_in_existed_at_close).to be(false)
  end

  it "AC-22 logout in one browser leaves the same user's connections in another browser open" do
    # A second browser has its own cookies. Both sign in as the same Google account.
    other_browser = open_session
    sign_in_with_google
    sign_in_with_google(other_browser)
    other_sign_in = SignIn.order(:id).last
    token = csrf_token

    expect {
      delete "/api/session", headers: { "X-CSRF-Token" => token }
    }.not_to have_broadcasted_to(internal_channel_of(other_sign_in))

    expect(response).to have_http_status(:no_content)
    expect(SignIn.all).to eq([ other_sign_in ])
  end

  it "AC-22 a logout when no one is signed in closes no connection" do
    # The user is signed in in another browser. This browser has no sign-in.
    other_browser = open_session
    sign_in_with_google(other_browser)
    other_sign_in = SignIn.sole

    expect {
      delete "/api/session"
    }.not_to have_broadcasted_to(internal_channel_of(other_sign_in))

    expect(response).to have_http_status(:no_content)
    expect(SignIn.all).to eq([ other_sign_in ])
  end
end

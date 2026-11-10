require "rails_helper"

# features/22_websocket_auth. Only pages of the app's own origin may open the WebSocket at
# /cable (spec question 6). Action Cable checks the origin before the connection opens, so
# before the sign-in.
RSpec.describe "The WebSocket address /cable", type: :request do
  it "AC-22 allows no origin but the app's own in every environment, so the development default of any localhost port does not apply" do
    # Action Cable's engine lets any http://localhost:<port> connect in development while this
    # setting is nil (action_cable/engine.rb). An empty list leaves only the same-origin check.
    expect(Rails.application.config.action_cable.allowed_request_origins).to eq([])
    expect(ActionCable.server.config.allowed_request_origins).to eq([])
    expect(ActionCable.server.config.allow_same_origin_as_host).to be(true)
    expect(ActionCable.server.config.disable_request_forgery_protection).to be_falsey
  end

  it "AC-22 answers 404 Page not found with no connection to another origin, to no origin, and to a plain GET, whatever the cookie" do
    host! "localhost:3000"
    websocket = {
      "Connection" => "Upgrade", "Upgrade" => "websocket",
      "Sec-WebSocket-Version" => "13", "Sec-WebSocket-Key" => "dGhlIHNhbXBsZSBub25jZQ=="
    }
    other_origin = websocket.merge("Origin" => "http://localhost:8080")
    answers = []
    answer = -> { answers << [ response.status, response.headers["Content-Type"], response.body ] }

    get "/cable", headers: other_origin
    answer.call

    # The same requests with a live sign-in's cookie.
    sign_in_with_google
    expect(cookies[session_cookie_name]).to be_present
    get "/cable", headers: other_origin
    answer.call
    get "/cable", headers: websocket
    answer.call
    get "/cable"
    answer.call

    expect(answers).to eq([ [ 404, "text/plain; charset=utf-8", "Page not found" ] ] * 4)
    expect(ActionCable.server.connections).to be_empty
  end
end

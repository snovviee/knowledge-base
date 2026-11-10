require "rails_helper"

# features/22_websocket_auth. A WebSocket connection is authorized by the browser's sign-in:
# the session cookie sent with the connection request must name a live sign-in.
#
# signed_in_browser, session_cookie_of, log_out, and send_session_cookie come from
# spec/support/cable_helpers.rb.
RSpec.describe ApplicationCable::Connection, type: :channel do
  include ActiveSupport::Testing::TimeHelpers

  after { travel_back }

  def user_with_uid(uid)
    User.find_by!(provider: "google_oauth2", provider_user_id: uid)
  end

  it "AC-22 accepts a connection whose session cookie names a live sign-in and identifies its user and sign-in" do
    browser = signed_in_browser(uid: "u-1", name: "Ada Lovelace")
    # Another user signs in after, so the connection cannot take the newest sign-in.
    signed_in_browser(uid: "u-2", name: "Grace Hopper")
    send_session_cookie(session_cookie_of(browser))

    connect

    ada = user_with_uid("u-1")
    expect(connection.current_user).to eq(ada)
    expect(connection.current_sign_in).to eq(ada.sign_ins.sole)
  end

  it "AC-22 refuses a connection with no session cookie or with the cookie of a browser that never signed in" do
    expect { connect }.to have_rejected_connection

    # A browser that only asked for an anti-forgery token has a session cookie, and no sign-in.
    browser = ActionDispatch::Integration::Session.new(Rails.application)
    csrf_token(browser)
    expect(session_cookie_of(browser)).to be_present
    send_session_cookie(session_cookie_of(browser))

    expect { connect }.to have_rejected_connection
  end

  it "AC-22 refuses a connection with a copy of the session cookie kept from before logout" do
    browser = signed_in_browser
    kept_cookie = session_cookie_of(browser)

    log_out(browser)
    expect(browser.response).to have_http_status(:no_content)
    send_session_cookie(kept_cookie)

    expect { connect }.to have_rejected_connection
  end

  it "AC-22 refuses a connection with a session cookie past its 30 days and accepts it at 29 days" do
    cookie = session_cookie_of(signed_in_browser)

    # No request renews the cookie in between: the sign-in itself stays.
    travel 29.days
    send_session_cookie(cookie)
    connect
    expect(connection.current_user).to eq(user_with_uid("u-1"))

    travel 2.days
    send_session_cookie(cookie)
    expect { connect }.to have_rejected_connection
    expect(user_with_uid("u-1").sign_ins.count).to eq(1)
  end

  it "AC-22 refuses a connection whose session cookie was changed or was not made by the app" do
    cookie = session_cookie_of(signed_in_browser(uid: "u-1", name: "Ada Lovelace"))
    signed_in_browser(uid: "u-2", name: "Grace Hopper")
    ada = user_with_uid("u-1")
    grace = user_with_uid("u-2")

    # The real cookie with one character of its encrypted data changed.
    changed = cookie.dup
    changed[5] = changed[5] == "A" ? "B" : "A"
    send_session_cookie(changed)
    expect { connect }.to have_rejected_connection

    send_session_cookie("not-a-cookie")
    expect { connect }.to have_rejected_connection

    # A session that names Ada's sign-in next to Grace's id. The lookup needs both to match.
    send_session_cookie(session_cookie_holding("sign_in_token" => ada.sign_ins.sole.token, "user_id" => grace.id))
    expect { connect }.to have_rejected_connection

    # The same helper with matching values is accepted, so the refusals above are not the helper's.
    send_session_cookie(session_cookie_holding("sign_in_token" => ada.sign_ins.sole.token, "user_id" => ada.id))
    connect
    expect(connection.current_user).to eq(ada)
  end

  it "AC-22 ignores a user id in the connection address and takes the user only from the cookie's sign-in" do
    cookie = session_cookie_of(signed_in_browser(uid: "u-1", name: "Ada Lovelace"))
    signed_in_browser(uid: "u-2", name: "Grace Hopper")
    grace = user_with_uid("u-2")

    # No cookie: the address does not sign anyone in.
    expect { connect "/cable?user_id=#{grace.id}" }.to have_rejected_connection

    send_session_cookie(cookie)
    connect "/cable?user_id=#{grace.id}"
    expect(connection.current_user).to eq(user_with_uid("u-1"))
    expect(connection.current_sign_in).to eq(user_with_uid("u-1").sign_ins.sole)
  end

  it "AC-22 handles commands while the sign-in lives and, once it is gone, closes the connection with the refusal and handles none" do
    send_session_cookie(session_cookie_of(signed_in_browser))
    connect
    # A connection under test has no subscriptions and no socket.
    subscriptions = instance_double(ActionCable::Connection::Subscriptions, execute_command: nil)
    allow(connection).to receive(:subscriptions).and_return(subscriptions)
    allow(connection).to receive(:close)
    command = { "command" => "subscribe", "identifier" => { channel: "ReviewRemindersChannel" }.to_json }

    connection.handle_channel_command(command)
    expect(subscriptions).to have_received(:execute_command).with(command).once
    expect(connection).not_to have_received(:close)

    # The sign-in is deleted on the server, and nothing closes the connection.
    connection.current_sign_in.delete
    connection.handle_channel_command(command)

    expect(subscriptions).to have_received(:execute_command).once
    expect(connection).to have_received(:close).with(reason: "unauthorized", reconnect: false).once
  end
end

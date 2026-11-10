require "rails_helper"

# features/23_websocket_client_message. Action Cable decodes a message command's data before
# any channel sees it, and when the data is missing or is not JSON text, it only logs the
# error. The app's connection hands such a message on with the data null, so the reminders
# channel answers it invalid like any other message that is not a well-formed ack (spec
# question 3). Feature 22's sign-in check still comes first (spec edge case).
#
# A connection under test has no subscriptions and no socket, so the test stubs both, as
# feature 22's command test does (spec/channels/application_cable/connection_spec.rb).
# signed_in_browser, session_cookie_of, and send_session_cookie come from
# spec/support/cable_helpers.rb.
RSpec.describe ApplicationCable::Connection, type: :channel do
  it "AC-23 a message whose data is not JSON goes to the channel as null, after the sign-in check" do
    send_session_cookie(session_cookie_of(signed_in_browser))
    connect
    subscriptions = instance_double(ActionCable::Connection::Subscriptions, execute_command: nil)
    allow(connection).to receive(:subscriptions).and_return(subscriptions)
    allow(connection).to receive(:close)
    message = { "command" => "message", "identifier" => { channel: "ReviewRemindersChannel" }.to_json }
    not_json = message.merge("data" => "not json")
    no_data = message
    # An object where Action Cable expects JSON text.
    not_text = message.merge("data" => { "action" => "ack" })
    ack = message.merge("data" => { action: "ack", note_id: 7, next_review_date: "2026-11-09" }.to_json)

    [ not_json, no_data, not_text, ack ].each { |command| connection.handle_channel_command(command) }

    expect(subscriptions).to have_received(:execute_command).with(message.merge("data" => "null")).exactly(3).times
    expect(subscriptions).to have_received(:execute_command).with(ack).once
    expect(connection).not_to have_received(:close)

    # The sign-in is deleted on the server, and nothing has closed the connection yet.
    connection.current_sign_in.delete
    connection.handle_channel_command(not_json)

    expect(subscriptions).to have_received(:execute_command).exactly(4).times
    expect(connection).to have_received(:close).with(reason: "unauthorized", reconnect: false).once
  end
end

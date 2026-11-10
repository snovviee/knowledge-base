require "rails_helper"

# features/22_websocket_auth. The reminders subscription belongs to the connection's user,
# and its parameters never choose the user (spec question 1). The batches are feature 20's.
#
# stub_signed_in_connection comes from spec/support/cable_helpers.rb.
RSpec.describe ReviewRemindersChannel, type: :channel do
  def sign_in_of_new_user(uid)
    User.create!(provider: "google_oauth2", provider_user_id: uid, display_name: uid).sign_ins.create!
  end

  it "AC-22 confirms the reminders subscription for the connection's own user and ignores a user_id parameter" do
    mine = sign_in_of_new_user("u-1")
    other_user = sign_in_of_new_user("u-2").user
    stub_signed_in_connection(mine)

    subscribe(user_id: other_user.id)

    expect(subscription).to be_confirmed
    expect(subscription.current_user).to eq(mine.user)
    expect(subscription.current_sign_in).to eq(mine)
  end

  it "AC-22 sends a message on the reminders subscription only while the sign-in lives, and once it is gone sends nothing and closes the connection with the refusal" do
    mine = sign_in_of_new_user("u-1")
    stub_signed_in_connection(mine)
    subscribe
    # Feature 20 sends the first batch as soon as the subscription is made. This test counts
    # only the messages it sends itself.
    connection.transmissions.clear
    # Any message to the subscriber, such as a batch of feature 20, goes through transmit.
    message = { "type" => "review_reminders", "reminders" => [] }

    subscription.send(:transmit, message)
    expect(transmissions).to eq([ message ])
    expect(connection.closes).to be_empty

    # The sign-in is deleted on the server, and nothing closes the connection.
    mine.delete
    subscription.send(:transmit, message)

    expect(transmissions).to eq([ message ])
    expect(connection.closes).to eq([ { reason: "unauthorized", reconnect: false } ])
  end
end

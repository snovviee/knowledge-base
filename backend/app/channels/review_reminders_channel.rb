# The review reminders of the connection's user, subscribed to with the identifier
# {"channel":"ReviewRemindersChannel"}. The user comes only from the connection's sign-in,
# so a parameter that names a user is ignored (features/22_websocket_auth question 1).
#
# The subscription receives the user's batch (ReviewReminderBatch) at once, then again at
# every check while it lives, an unchanged batch included (features/20_realtime_notifications
# question 4). Every message goes out through ApplicationCable::Channel's private transmit,
# which checks the sign-in first. The client sends one message, the ack of a reminder
# (features/23_websocket_client_message): ack and perform_action are the channel's only
# actions.
class ReviewRemindersChannel < ApplicationCable::Channel
  # How often the server checks the reminders again. Each subscription has its own timer,
  # which Action Cable stops when the subscription or the connection ends.
  CHECK_INTERVAL = 60.seconds

  periodically :send_batch, every: CHECK_INTERVAL

  # Sends the user's current batch to each of the user's subscriptions, in every tab and
  # browser, through the user's stream: right after a change (spec question 5). Action Cable
  # hands a streamed message to the channel's transmit, so the sign-in check applies to it
  # too. A class method, so it is not an action that a client can call.
  def self.send_batch_to(user)
    broadcast_to(user, ReviewReminderBatch.for(user))
  end

  # Action Cable calls this for every message a client sends on the subscription, with the
  # message's data decoded. Only an ack goes on to Action Cable's dispatch. Anything else,
  # another action, no action, or data that is not a JSON object, answers invalid to the
  # sender, and nothing changes (features/23_websocket_client_message question 3). Public, as
  # in Action Cable, so it is an action too: a message with the action "perform_action"
  # comes back here and answers invalid.
  def perform_action(data)
    if data.is_a?(Hash) && data["action"] == "ack"
      super
    else
      transmit({ type: "error", error: "invalid" })
    end
  end

  # The ack of a reminder (features/23_websocket_client_message questions 1 to 3), for the
  # connection's user, read again as for a batch, so it is judged on the today of the
  # batches. An ack that is not accepted answers its error code to the sender. An accepted
  # one answers nothing to the sender, and each open connection of the user receives a new
  # batch without the reminder at once (question 2).
  def ack(data)
    user = User.find(current_user.id)
    error = ReviewAck.new(user, data).record
    if error
      transmit({ type: "error", error: error })
    else
      self.class.send_batch_to(user)
    end
  end

  private

    def subscribed
      stream_for current_user
      send_batch
    end

    # The user is read again for each batch: the connection's current_user was loaded when
    # the connection opened, and a time zone saved since then, by another browser's session
    # check, applies from the next batch (spec edge case).
    def send_batch
      transmit ReviewReminderBatch.for(User.find(current_user.id))
    end
end

# Sends the signed-in user's new review reminders batch to each of their open connections,
# right after a change that a batch shows (features/20_realtime_notifications question 5).
# A controller declares it with one after_action, for the actions that change what a batch
# holds. It is the only place in the HTTP API that sends a batch, at most once per request.
#
#   include SendsReviewReminders
#   after_action :send_review_reminders, only: %i[create update]
#
# Only a success (2xx) sends: a refused request (422, or a 409 answered by the action)
# changed nothing. A 401 from require_signed_in_user halts the chain, and an exception that
# ApplicationController answers (403, 400, 404) aborts it, so neither reaches an after_action.
module SendsReviewReminders
  private

    def send_review_reminders
      ReviewRemindersChannel.send_batch_to(current_user) if response.successful?
    end
end

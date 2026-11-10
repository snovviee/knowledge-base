# A review dismissal (features/23_websocket_client_message question 2): the user dismissed
# the reminder of one of their notes for the note's next review date.
class ReviewDismissal < ApplicationRecord
  belongs_to :user
  belongs_to :note
end

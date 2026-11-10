# One browser where a user is signed in (features/05_logout). The session names it
# by its random token. Logout deletes it, so a kept copy of the session cookie
# signs no one in.
class SignIn < ApplicationRecord
  belongs_to :user
  has_secure_token

  # The live sign-in that a session names, or nil: the session holds the sign-in's token
  # next to its user's id. The HTTP API and the WebSocket connection both find the
  # signed-in user here, so the two cannot drift apart (features/22_websocket_auth).
  def self.of_session(session)
    token = session["sign_in_token"]
    token && find_by(token: token, user_id: session["user_id"])
  end

  # Whether this sign-in has ended since it was loaded: logout, or any other deletion,
  # removes its row. An open WebSocket connection asks before each command and each
  # message (features/22_websocket_auth question 5).
  def ended?
    !self.class.exists?(id)
  end
end

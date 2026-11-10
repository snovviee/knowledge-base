module ApplicationCable
  # The base of every channel. A channel's public methods are actions that a client can
  # call, so every helper here is private (features/22_websocket_auth).
  class Channel < ActionCable::Channel::Base
    private
      # Every message to a subscriber goes through here: feature 20's batches, feature 23's
      # answers, and anything streamed. Once the connection's sign-in is gone, nothing more
      # is sent, and the connection is closed with the refusal
      # (features/22_websocket_auth question 5).
      def transmit(data, via: nil)
        if current_sign_in.ended?
          connection.close(**Connection::REFUSAL)
        else
          super
        end
      end
  end
end

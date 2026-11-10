module ApplicationCable
  # A WebSocket connection at /cable. It belongs to the browser's live sign-in, found from
  # the session cookie sent with the connection request, as for the HTTP API
  # (features/22_websocket_auth question 1).
  class Connection < ActionCable::Connection::Base
    identified_by :current_user, :current_sign_in

    # How a connection whose sign-in has ended is closed: the client receives
    # {"type":"disconnect","reason":"unauthorized","reconnect":false}, the same message as
    # a refused connection (question 5).
    REFUSAL = { reason: ActionCable::INTERNAL[:disconnect_reasons][:unauthorized], reconnect: false }.freeze

    before_command :require_live_sign_in

    # With no live sign-in, Action Cable sends the client
    # {"type":"disconnect","reason":"unauthorized","reconnect":false} and closes the
    # connection (question 2). A missing cookie, or one the app did not make, reads as nil.
    def connect
      sign_in = SignIn.of_session(cookies.encrypted[session_cookie_name] || {})
      reject_unauthorized_connection unless sign_in

      self.current_sign_in = sign_in
      self.current_user = sign_in.user
    end

    # Action Cable decodes a message command's data before any channel sees it, and when the
    # data is missing or is not JSON text, it only logs the error and answers nothing. Such a
    # message goes on with the data null, so the channel answers it invalid, like any other
    # message that is not a well-formed ack (features/23_websocket_client_message question 3).
    # Every other command goes on as it is. super runs before_command first, so the sign-in
    # is still checked before anything is handled. Public, as in Action Cable.
    def handle_channel_command(payload)
      super(with_readable_data(payload))
    end

    private
      def with_readable_data(payload)
        return payload unless payload.is_a?(Hash) && payload["command"] == "message"

        ActiveSupport::JSON.decode(payload["data"])
        payload
      rescue JSON::ParserError, TypeError
        payload.merge("data" => "null")
      end

      # Before each command a client sends (subscribe, unsubscribe, and message): once the
      # connection's sign-in is gone, the command is not handled, and the connection is
      # closed with the refusal (question 5).
      def require_live_sign_in
        return unless current_sign_in.ended?

        close(**REFUSAL)
        throw :abort
      end

      # The encrypted cookie that the session middleware writes. Reading it checks that the
      # app made it and that its 30 days have not passed, as for HTTP
      # (features/04_session_persistence).
      def session_cookie_name
        Rails.application.config.session_options.fetch(:key)
      end
  end
end

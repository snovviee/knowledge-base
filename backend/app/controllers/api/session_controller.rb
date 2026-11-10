module Api
  class SessionController < ApplicationController
    # A logout when no one is signed in has nothing to end, so it answers 204 before
    # the token check runs (features/05_logout question 2).
    prepend_before_action :no_content_unless_signed_in, only: :destroy

    # The signed-in user, or 401 (api error body: { "error": "<code>" }). The app sends
    # the browser's time zone with this check, and it is saved on the user
    # (features/12_review_interval_setting question 1).
    def show
      user = current_user

      if user
        save_time_zone(user)
        render json: { user: { id: user.id, display_name: user.display_name } }
      else
        render json: { error: "unauthenticated" }, status: :unauthorized
      end
    end

    # Logout (features/05_logout): 204 with no body. Deleting this browser's sign-in
    # ends it for good, so a kept copy of the cookie signs no one in. The response
    # sets a new, empty session cookie.
    def destroy
      sign_in = current_sign_in
      sign_in.destroy
      close_connections_of(sign_in)
      reset_session
      head :no_content
    end

    private

      def no_content_unless_signed_in
        head :no_content unless current_sign_in
      end

      # Closes every open WebSocket connection of the sign-in that logout ended, in every
      # tab of this browser, and tells each not to reconnect. The same user's other
      # sign-ins keep theirs. It runs after the deletion, so a connection that opens in
      # between is refused (features/22_websocket_auth question 4).
      def close_connections_of(sign_in)
        ActionCable.server.remote_connections
          .where(current_user: sign_in.user, current_sign_in: sign_in)
          .disconnect(reconnect: false)
      end

      # The zone in the X-Time-Zone header, written only when it differs from the saved
      # one. The browser that loaded last decides (features/12_review_interval_setting
      # question 1). A check that names no zone, such as one from curl, keeps the saved
      # zone (question 19).
      def save_time_zone(user)
        name = request.headers["X-Time-Zone"]
        return if name.blank?

        time_zone = known_time_zone(name)
        user.update!(time_zone: time_zone) unless user.time_zone == time_zone
      end

      # The zone's name when the server's tz database knows it, else nil, so that "today"
      # is UTC (features/12_review_interval_setting question 1). TZInfo reads the data of
      # the tzinfo-data gem, which has the old names that the tz database keeps as links,
      # such as Asia/Calcutta, and saves them as sent. Its names are case-sensitive. A
      # value that it cannot read as a name, such as bytes that are not ASCII, is not
      # known either.
      def known_time_zone(name)
        TZInfo::Timezone.get(name).identifier
      rescue TZInfo::InvalidTimezoneIdentifier, EncodingError
        nil
      end
  end
end

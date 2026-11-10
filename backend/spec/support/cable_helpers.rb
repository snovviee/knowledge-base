require_relative "request_helpers"

# Helpers for the WebSocket specs (features/22_websocket_auth): the connection and channel
# specs (type: :channel) and the request specs of /cable and logout.
module CableHelpers
  include RequestHelpers

  # The session cookie's name, as the session middleware writes it (config/application.rb).
  def session_cookie_name
    Rails.application.config.session_options.fetch(:key)
  end

  # A browser signed in through the real Google callback (OmniAuth test mode), with cookies
  # of its own. Its session cookie is the one the app really sets, and it can log out later.
  def signed_in_browser(uid: "u-1", name: "Ada Lovelace")
    ActionDispatch::Integration::Session.new(Rails.application).tap do |browser|
      sign_in_with_google(browser, uid: uid, name: name)
    end
  end

  # The browser's session cookie as the browser holds it: the raw value, not URL-escaped.
  def session_cookie_of(browser)
    browser.cookies[session_cookie_name]
  end

  # Logs the browser out as the app does: DELETE /api/session with the browser's own token.
  def log_out(browser)
    browser.delete "/api/session", headers: { "X-CSRF-Token" => csrf_token(browser) }
  end

  # The internal channel of a sign-in's connections. Action Cable closes them with a
  # disconnect message broadcast here (ActionCable.server.remote_connections).
  def internal_channel_of(sign_in)
    "action_cable/" + [ sign_in.user, sign_in ].map(&:to_gid_param).sort.join(":")
  end
end

# Connection and channel specs only.
module CableConnectionHelpers
  # The next connection request carries this session cookie, URL-escaped as a browser sends
  # it, through a real cookie jar. The jar decrypts it and checks its 30 days, as for the
  # HTTP API. The stock test jar does neither.
  def send_session_cookie(raw)
    header = "#{session_cookie_name}=#{Rack::Utils.escape(raw)}"
    env = Rails.application.env_config.merge(Rack::MockRequest.env_for("/cable", "HTTP_COOKIE" => header))
    @real_cookie_jar = ActionDispatch::Request.new(env).cookie_jar
  end

  # A raw session cookie that holds this session, encrypted with the app's own key the way
  # the session middleware writes it.
  def session_cookie_holding(session)
    jar = ActionDispatch::Request.new(Rails.application.env_config.merge(Rack::MockRequest.env_for("/"))).cookie_jar
    jar.encrypted[session_cookie_name] = { value: session }
    jar[session_cookie_name]
  end

  # The cookies of the next connection request: the real jar of send_session_cookie, or else
  # the stock test jar. The stock jar keeps a Hash value only as { value: { ... } }; a bare
  # Hash reads back as nil.
  def cookies
    @real_cookie_jar || super
  end

  # A channel spec's connection, identified by the sign-in and its user. Action Cable's stub
  # connection has no close, so this one records the options of each close in closes.
  def stub_signed_in_connection(sign_in)
    stub_connection(current_user: sign_in.user, current_sign_in: sign_in)
    closes = []
    connection.define_singleton_method(:close) { |**options| closes << options }
    connection.define_singleton_method(:closes) { closes }
  end
end

RSpec.configure do |config|
  config.include CableHelpers, type: :channel
  config.include CableHelpers, type: :request
  config.include CableConnectionHelpers, type: :channel
end

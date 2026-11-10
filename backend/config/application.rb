require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
# require "active_storage/engine"
require "action_controller/railtie"
# require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module KnowledgeBase
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true

    # API mode leaves out the cookie and session middleware. Sign-in needs both
    # (features/01_google_sign_in). The session holds only the signed-in user's id.
    # A sign-in lasts until 30 days pass without a request: each request that reads
    # the session sends the cookie again with a new expiry, and the encrypted cookie
    # carries the same expiry, so the server refuses a cookie kept past it
    # (features/04_session_persistence). The cookie's name is set only here: the WebSocket
    # connection reads the same cookie through config.session_options
    # (features/22_websocket_auth).
    config.session_store :cookie_store, key: "_knowledge_base_session", expire_after: 30.days
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use config.session_store, config.session_options

    # Only pages of the app's own origin may open the WebSocket at /cable: the Origin header
    # must equal the request's scheme and Host (allow_same_origin_as_host). The empty list
    # also turns off the development default that lets any http://localhost:<port> connect.
    # Another origin, or none, is answered 404 before the sign-in is checked
    # (features/22_websocket_auth question 6).
    config.action_cable.allowed_request_origins = []
  end
end

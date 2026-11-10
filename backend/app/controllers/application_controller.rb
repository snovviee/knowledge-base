class ApplicationController < ActionController::API
  # A request that changes state must carry this session's anti-forgery token from
  # GET /api/csrf in the X-CSRF-Token header. GET requests are not checked
  # (features/05_logout question 1).
  include ActionController::RequestForgeryProtection
  protect_from_forgery with: :exception

  rescue_from ActionController::InvalidAuthenticityToken do
    render json: { error: "invalid_csrf_token" }, status: :forbidden
  end

  # A body that cannot be read as JSON. Rails parses it when params are first read,
  # in the forgery check or the action (features/06_collections_crud question 2).
  rescue_from ActionDispatch::Http::Parameters::ParseError do
    render json: { error: "bad_request" }, status: :bad_request
  end

  # Lookups go through current_user, so another user's record is not found either,
  # and an answer never tells whether it exists (features/06_collections_crud question 3).
  rescue_from ActiveRecord::RecordNotFound do
    render json: { error: "not_found" }, status: :not_found
  end

  private

    # Every answer of an endpoint under /api tells the browser to keep no copy of it:
    # Cache-Control: no-store, errors included (features/21_data_privacy question 3). It is
    # set before the callbacks and the rescues run, so the 401 of require_signed_in_user
    # (prepended in each controller), the 204 of a logout with no sign-in, and the rescue_from
    # answers carry it too. A before_action here would run after the prepended checks, and an
    # after_action is skipped when a callback halts or an action raises. The sign-in callbacks
    # (Auth::SessionsController) are not under /api, and keep Rails' headers.
    def process_action(*)
      no_store if self.class.module_parent == Api
      super
    end

    # This browser's sign-in, while it lasts: the session names it by its token, next
    # to the user's id, and logout deletes it (features/05_logout). nil when no one is
    # signed in, so a kept copy of a logged-out session cookie signs no one in.
    def current_sign_in
      @current_sign_in ||= SignIn.of_session(session)
    end

    # The signed-in user. Every endpoint that needs one uses this, not the session's
    # user id alone.
    def current_user
      current_sign_in&.user
    end

    # A before action for every endpoint that reaches a user's data: 401 when no one
    # is signed in (features/06_collections_crud).
    def require_signed_in_user
      render json: { error: "unauthenticated" }, status: :unauthorized unless current_user
    end

    # 422 with one code per invalid field, for example
    # { "error": "validation_failed", "fields": { "name": "taken" } }
    # (features/06_collections_crud question 1).
    def render_validation_failed(record)
      fields = record.errors.details.transform_values { |details| details.first[:error] }
      render json: { error: "validation_failed", fields: fields }, status: :unprocessable_content
    end
end

module Auth
  class SessionsController < ApplicationController
    # GET /auth/google_oauth2/callback. OmniAuth has already checked the state
    # and exchanged the code, so auth.uid and auth.info are trusted here.
    def google
      auth = request.env["omniauth.auth"]

      user = User.find_by(provider: auth.provider, provider_user_id: auth.uid) ||
        User.create!(
          provider: auth.provider,
          provider_user_id: auth.uid,
          display_name: auth.info.name,
          email: auth.info.email,
          avatar_url: auth.info.image
        )

      session[:user_id] = user.id
      redirect_to "/", allow_other_host: false
    end
  end
end

module Auth
  class SessionsController < ApplicationController
    # GET /auth/google_oauth2/callback and GET /auth/github/callback. OmniAuth has
    # already checked the state and exchanged the code, so auth.uid and auth.info
    # are trusted here.
    def google
      sign_in_from_provider
    end

    def github
      sign_in_from_provider
    end

    private

      def sign_in_from_provider
        auth = request.env["omniauth.auth"]

        user = User.find_by(provider: auth.provider, provider_user_id: auth.uid) ||
          User.create!(
            provider: auth.provider,
            provider_user_id: auth.uid,
            display_name: display_name_for(auth),
            email: auth.info.email,
            avatar_url: auth.info.image
          )

        session[:user_id] = user.id
        redirect_to "/", allow_other_host: false
      end

      # GitHub users may leave their public name empty. The record needs a display
      # name, so the GitHub login is used then (features/02_github_sign_in question 4).
      def display_name_for(auth)
        name = auth.info.name.to_s.strip
        name.presence || auth.info.nickname.presence || auth.info.name
      end
  end
end

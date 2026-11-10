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

        user = find_or_create_user(auth)
        return redirect_to "/?sign_in_error=#{auth.provider == 'github' ? 'github' : 'google'}" unless user

        session[:user_id] = user.id
        # This browser's sign-in. Logout deletes it, which ends this sign-in for good
        # (features/05_logout).
        session[:sign_in_token] = user.sign_ins.create!.token
        redirect_to "/", allow_other_host: false
      end

      # Find the account, or create it on the first sign-in (AC-03). Two sign-ins for
      # the same new account can race: the second create then fails because the
      # account already exists. In that case the record the other request made is used.
      def find_or_create_user(auth)
        User.find_by(provider: auth.provider, provider_user_id: auth.uid) ||
          User.create!(
            provider: auth.provider,
            provider_user_id: auth.uid,
            display_name: display_name_for(auth),
            email: auth.info.email,
            avatar_url: auth.info.image
          )
      rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique
        # A duplicate is a race: use the record the other request created. Any other
        # invalid record (for example no name at all) is a failed sign-in, which returns
        # nil and takes the same failure redirect as a cancelled sign-in.
        User.find_by(provider: auth.provider, provider_user_id: auth.uid)
      end

      # GitHub users may leave their public name empty. The record needs a display
      # name, so the GitHub login is used then (features/02_github_sign_in question 4).
      def display_name_for(auth)
        name = auth.info.name.to_s.strip
        name.presence || auth.info.nickname.presence || auth.info.name
      end
  end
end

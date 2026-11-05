module Api
  class SessionController < ApplicationController
    # The signed-in user, or 401 (api error body: { "error": "<code>" }).
    def show
      user = User.find_by(id: session[:user_id])

      if user
        render json: { user: { id: user.id, display_name: user.display_name } }
      else
        render json: { error: "unauthenticated" }, status: :unauthorized
      end
    end
  end
end

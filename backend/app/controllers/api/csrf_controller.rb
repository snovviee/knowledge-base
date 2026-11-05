module Api
  class CsrfController < ApplicationController
    # API mode leaves out the forgery helpers that form_authenticity_token needs.
    include ActionController::RequestForgeryProtection

    # The sign-in start is a POST form that carries this token (features/01_google_sign_in).
    def show
      render json: { token: form_authenticity_token }
    end
  end
end

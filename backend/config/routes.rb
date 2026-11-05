Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    get "csrf", to: "csrf#show"
    get "session", to: "session#show"
  end

  get "auth/google_oauth2/callback", to: "auth/sessions#google"
  get "auth/github/callback", to: "auth/sessions#github"

  # Defines the root path route ("/")
  # root "posts#index"
end

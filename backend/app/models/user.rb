class User < ApplicationRecord
  validates :provider, :provider_user_id, :display_name, presence: true
  validates :provider_user_id, uniqueness: { scope: :provider }
end

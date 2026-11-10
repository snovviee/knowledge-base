class User < ApplicationRecord
  has_many :sign_ins, dependent: :delete_all
  has_many :collections
  has_many :tags
  has_many :notes

  validates :provider, :provider_user_id, :display_name, presence: true
  validates :provider_user_id, uniqueness: { scope: :provider }

  # The current date in the user's saved time zone, or in UTC while none is saved
  # (features/12_review_interval_setting question 1). Only zone names the server knows
  # are saved (Api::SessionController). It reads Time.current, never Date.today, which
  # uses the server machine's zone.
  def today
    Time.current.in_time_zone(time_zone || "UTC").to_date
  end
end

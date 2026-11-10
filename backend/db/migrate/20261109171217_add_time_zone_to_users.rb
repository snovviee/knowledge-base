# features/12_review_interval_setting. The IANA name of the time zone the app last
# reported in a session check, when the server knows it (spec questions 1 and 19).
# "Today" is the date in this zone, and in UTC while it is null.
class AddTimeZoneToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :time_zone, :string
  end
end

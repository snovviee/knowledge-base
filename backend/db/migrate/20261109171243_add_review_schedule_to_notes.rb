# features/12_review_interval_setting. A note's review schedule (requirements.md 3.4):
# the interval (none, daily, weekly, monthly, or custom; existing notes get none), the
# number of days of a custom interval, the next review date (set exactly when the
# interval is not none), and the last reviewed date, which feature 13 sets. The dates
# are calendar dates with no time or zone (spec question 2). Nothing looks notes up by
# these columns yet, so there is no index.
class AddReviewScheduleToNotes < ActiveRecord::Migration[8.1]
  def change
    add_column :notes, :review_interval, :string, null: false, default: "none"
    add_column :notes, :review_interval_days, :integer
    add_column :notes, :next_review_date, :date
    add_column :notes, :last_reviewed_date, :date
  end
end

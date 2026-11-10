# The review dismissals of a note (features/23_websocket_client_message question 2). A
# dismissal lasts while the note keeps the next review date it was made for. Any save that
# changes that date ends the note's dismissals: a review (features 13 and 14), a new date in
# the edit form, and the interval None, which removes the date (features/12_review_interval_setting
# questions 7 and 11). So a date that later returns to a dismissed one reminds again. An
# archive, a restore, an interval change that keeps the date, and a second review on the
# same day change no date, and keep them. update_columns skips callbacks, and so this one.
module ReviewDismissible
  extend ActiveSupport::Concern

  included do
    # Deleted with the note, as the foreign key's cascade also does.
    has_many :review_dismissals, dependent: :delete_all
    after_update :end_review_dismissals, if: :saved_change_to_next_review_date?
  end

  private

    def end_review_dismissals
      review_dismissals.delete_all
    end
end

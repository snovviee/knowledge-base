# features/23_websocket_client_message. A review dismissal records an ack: the user
# dismissed the reminder of a note for its next review date (spec question 2), the
# "notification acknowledgement" of requirements.md 6. One row per note and date. The rows
# go with their note (spec edge case: deleting a note deletes its dismissals), so the
# note's foreign key cascades. The unique index on the note and the date also serves the
# lookups by note.
class CreateReviewDismissals < ActiveRecord::Migration[8.1]
  def change
    create_table :review_dismissals do |t|
      t.references :user, null: false, foreign_key: true
      t.references :note, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.date :next_review_date, null: false

      t.timestamps
    end
    add_index :review_dismissals, [ :note_id, :next_review_date ], unique: true
  end
end

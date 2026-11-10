# features/09_notes_crud. A note belongs to a user and to one of that user's
# collections. The collection's foreign key has no cascade: until feature 07 decides
# what deleting a collection does to its notes, the database refuses to delete a
# collection that still has notes (spec question 15). The columns of later ACs (tags,
# the review interval and dates) come with their own features.
class CreateNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :notes do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :collection, null: false, foreign_key: true
      t.string :title, null: false
      t.text :body, null: false
      t.string :source_url
      t.string :status, null: false, default: "active"

      t.timestamps
    end
    add_index :notes, [ :user_id, :created_at ]
  end
end

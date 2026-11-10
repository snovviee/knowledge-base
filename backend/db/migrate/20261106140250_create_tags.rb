# features/08_tags_crud. The same shape as collections (feature 06): name is the name
# as shown, and folded_name is the same name in Unicode NFC, case-folded. Names are
# unique among a user's tags ignoring case in any alphabet, and SQLite's NOCASE and
# LOWER() fold only ASCII letters.
class CreateTags < ActiveRecord::Migration[8.1]
  def change
    create_table :tags do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.string :name, null: false
      t.string :folded_name, null: false

      t.timestamps
    end
    add_index :tags, [ :user_id, :folded_name ], unique: true
  end
end

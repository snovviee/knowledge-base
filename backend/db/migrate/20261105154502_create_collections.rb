# features/06_collections_crud. name is the name as shown. folded_name is the same name
# in Unicode NFC, case-folded: names are unique per user ignoring case in any
# alphabet, and SQLite's NOCASE and LOWER() fold only ASCII letters.
class CreateCollections < ActiveRecord::Migration[8.1]
  def change
    create_table :collections do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.string :name, null: false
      t.string :folded_name, null: false

      t.timestamps
    end
    add_index :collections, [ :user_id, :folded_name ], unique: true
  end
end

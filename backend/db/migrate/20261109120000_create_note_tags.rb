# features/10_note_tags. A note has zero or more tags, and a tag is on a note once. The
# links are removed with their note and with their tag (spec: deleting a tag keeps its
# notes, requirements.md 3.3), so both foreign keys cascade.
class CreateNoteTags < ActiveRecord::Migration[8.1]
  def change
    create_table :note_tags, id: false do |t|
      t.references :note, null: false, foreign_key: { on_delete: :cascade }
      t.references :tag, null: false, foreign_key: { on_delete: :cascade }
    end
    add_index :note_tags, [ :note_id, :tag_id ], unique: true
  end
end

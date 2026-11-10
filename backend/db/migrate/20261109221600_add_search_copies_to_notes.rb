# features/17_search_and_filter. The search copies of a note's title, body, and source URL
# (spec questions 4 and 13): each field in Unicode NFC, case-folded, with each run of
# whitespace made one space and the ends trimmed; null for a note with no source URL.
# SQLite's LIKE and LOWER fold only ASCII letters, so the search compares these copies
# with the search text folded the same way. The model sets them before every save; this
# migration fills them for the notes that exist, with its own copy of the rule, so it
# does not depend on the model as it is later. No index: the match uses instr, which no
# index serves, over one user's notes.
class AddSearchCopiesToNotes < ActiveRecord::Migration[8.1]
  # The notes table as this migration sees it, with no callbacks or validations.
  class MigrationNote < ActiveRecord::Base
    self.table_name = "notes"
  end

  def up
    add_column :notes, :search_title, :string
    add_column :notes, :search_body, :text
    add_column :notes, :search_source_url, :string

    MigrationNote.reset_column_information
    MigrationNote.find_each do |note|
      note.update_columns(
        search_title: fold(note.title), search_body: fold(note.body), search_source_url: fold(note.source_url)
      )
    end
  end

  def down
    remove_column :notes, :search_source_url
    remove_column :notes, :search_body
    remove_column :notes, :search_title
  end

  private

    # NFC, then case folding in any alphabet, then each run of whitespace one space with
    # the ends trimmed. nil stays nil.
    def fold(text)
      text&.unicode_normalize(:nfc)&.downcase(:fold)&.squish
    end
end

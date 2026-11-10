# The link between a note and one of its user's tags (features/10_note_tags). A note
# is linked to a tag once: the unique index on (note_id, tag_id) refuses a second link.
class NoteTag < ApplicationRecord
  self.primary_key = [ :note_id, :tag_id ]

  belongs_to :note
  belongs_to :tag
end

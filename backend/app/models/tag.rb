# A user's label for notes (features/08_tags_crud). Tags have the name rules of
# collections, in UniquelyNamed: the API sends each validation code on name as is.
class Tag < ApplicationRecord
  include UniquelyNamed

  belongs_to :user
  # A tag's links are removed with it, and no note (features/10_note_tags).
  has_many :note_tags, dependent: :delete_all
  has_many :notes, through: :note_tags
end

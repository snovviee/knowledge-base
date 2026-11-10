# A user's group of related notes (features/06_collections_crud). Its name rules
# (tidied, required, at most 100 characters, unique per user ignoring case, and the
# alphabetical order) are in UniquelyNamed, which tags share.
class Collection < ApplicationRecord
  include UniquelyNamed

  belongs_to :user
end

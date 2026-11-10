# The name rules that collections (features/06_collections_crud) and tags
# (features/08_tags_crud) share. The model has a user, a name, and a folded_name
# column. The API sends each validation code on name as is: blank, too_long, or taken.
module UniquelyNamed
  extend ActiveSupport::Concern

  included do
    # The ends are trimmed, and each run of whitespace inside becomes one space,
    # before any rule is checked (features/06_collections_crud question 5).
    normalizes :name, with: ->(name) { name.squish }

    validates :name, presence: true, length: { maximum: 100 }
    validate :name_not_taken

    # Alphabetical, ignoring case (features/06_collections_crud question 8).
    scope :alphabetical, -> { order(:folded_name, :id) }
  end

  # Setting the name also sets folded_name: the name in Unicode NFC, case-folded.
  def name=(value)
    super
    self.folded_name = name&.unicode_normalize(:nfc)&.downcase(:fold)
  end

  private

    # Names are unique per user among records of the same model, ignoring case in any
    # alphabet (features/06_collections_crud question 6), so a tag may have the name of
    # a collection. The record itself does not count, so it may change only the case
    # of its name.
    def name_not_taken
      return if folded_name.blank?

      taken = self.class.where(user_id: user_id, folded_name: folded_name).where.not(id: id).exists?
      errors.add(:name, :taken) if taken
    end
end

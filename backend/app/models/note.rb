# A user's note, kept in one of their collections (features/09_notes_crud). The API
# sends each validation code as is.
class Note < ApplicationRecord
  # A web address (spec question 5): http:// or https:// in any letter case, a host,
  # and no spaces. The note form in the browser uses the same pattern
  # (frontend/src/NoteForm.tsx), so both sides agree.
  WEB_ADDRESS = %r{\Ahttps?://[^[:space:]/?#]+(?:[/?#][^[:space:]]*)?\z}i
  # Active or Archived (requirements.md 3.4). A new note is active (the column's default).
  STATUSES = %w[active archived].freeze
  # The review intervals (requirements.md 3.4; features/12_review_interval_setting
  # question 15). A new note has none (the column's default, question 4).
  REVIEW_INTERVALS = %w[none daily weekly monthly custom].freeze

  belongs_to :user
  # collection_of_the_user checks it, with the codes of the API's collection_id field.
  belongs_to :collection, optional: true
  # A note's links are removed with it, and its tags stay (features/10_note_tags).
  has_many :note_tags, dependent: :delete_all
  has_many :tags, through: :note_tags
  include ReviewDismissible

  # The tag ids a request sent with the note (features/10_note_tags). nil when the
  # request sent none, which leaves the tags as they are.
  attr_accessor :requested_tag_ids
  # True when the request sent a tag_ids that is not a list (features/10_note_tags).
  attr_accessor :tag_ids_not_a_list

  # Adds a tag once: a second add of a tag the note has changes nothing, so a note keeps
  # one link per tag (spec edge case; the unique index refuses a second row).
  def add_tag(tag)
    tags << tag unless tags.include?(tag)
  end

  # Marks the note as reviewed: its last reviewed date becomes the user's today, the date
  # in their saved time zone (features/13_mark_reviewed; features/12_review_interval_setting
  # question 1), and its next review date today plus the interval the note has now, by the
  # calculation a new schedule uses, or none for the interval none. It counts from the
  # review day, never from the old date (features/14_review_date_recalc question 1). Nothing
  # else changes, the updated date included (features/13_mark_reviewed spec edge case), so
  # the save does not touch it, and a second review on the same day writes nothing (its
  # question 2). It is still a save: the checks and callbacks run as for any other save.
  def mark_reviewed!
    today = user.today
    self.last_reviewed_date = today
    self.next_review_date = review_date_after(today)
    save!(touch: false)
  end

  # The note's review state on the given day, the user's today (features/15_review_due_today
  # questions 1 and 2): "due_today" for an active note with a schedule whose next review date
  # is today, "overdue" for one whose date is before today (requirements.md 3.5), and nil for
  # any other note: archived, with the interval none, or dated later. Today is passed in, so
  # one request or one batch judges every note on the same date.
  def review_state(today)
    return unless status == "active" && review_interval != "none" && next_review_date

    if next_review_date == today
      "due_today"
    elsif next_review_date < today
      "overdue"
    end
  end

  # The ends are trimmed, and each run of whitespace inside becomes one space, as in a
  # name (spec question 3). The body is kept as typed.
  normalizes :title, with: ->(title) { title.squish }
  # The ends are trimmed, and an empty source URL is none (spec question 3).
  normalizes :source_url, with: ->(url) { url.gsub(/\A[[:space:]]+|[[:space:]]+\z/, "").presence }

  # The limits of spec question 4, counted after the tidying above.
  validates :title, presence: true, length: { maximum: 200 }
  # Only spaces and line breaks count as blank.
  validates :body, presence: true, length: { maximum: 100_000 }
  validates :source_url, length: { maximum: 2000 }, format: { with: WEB_ADDRESS }, allow_nil: true
  validate :collection_of_the_user
  validate :status_known
  validate :review_interval_known
  validate :custom_days_whole
  validate :next_review_date_real
  validate :tag_ids_list
  validate :tags_of_the_user

  # The schedule's values that its interval does not use are dropped before any check
  # (features/12_review_interval_setting question 12).
  before_validation :drop_unused_schedule_values
  # A schedule saved without a next review date counts from the user's today
  # (features/12_review_interval_setting question 8).
  before_save :schedule_from_today
  # The search copies follow the title, the body, and the source URL on every save, whatever
  # saves the note (features/17_search_and_filter questions 4 and 13).
  before_save :set_search_copies

  # The search's one folding rule, for the copies and for the search text alike
  # (features/17_search_and_filter questions 4 and 13): the text in Unicode NFC, case-folded
  # in any alphabet as names are (UniquelyNamed), with each run of whitespace one space and
  # the ends trimmed. Accents stay. nil stays nil.
  def self.fold_for_search(text)
    text&.unicode_normalize(:nfc)&.downcase(:fold)&.squish
  end

  # Newest first, by the created date (spec question 2).
  scope :newest_first, -> { order(created_at: :desc, id: :desc) }
  # Active notes, not archived (requirements.md 3.4).
  scope :active, -> { where(status: "active") }
  # Notes with a review schedule: an interval other than none (requirements.md 3.5).
  scope :scheduled, -> { where.not(review_interval: "none") }
  # The notes whose review_state on the given day is "due_today" (features/15_review_due_today
  # question 1). It chains on a user's notes: user.notes.due_today(user.today).
  scope :due_today, ->(today) { active.scheduled.where(next_review_date: today) }
  # The notes whose review_state on the given day is "overdue": dated before today, whatever
  # the age (features/16_review_overdue question 1). It never shares a note with due_today,
  # and it chains on a user's notes: user.notes.overdue(user.today).
  scope :overdue, ->(today) { active.scheduled.where(next_review_date: ...today) }
  # The active notes with a schedule whose next review date is from tomorrow through today
  # plus 7 days (features/17_search_and_filter question 7). It never shares a note with
  # due_today or overdue, and it chains on a user's notes as they do.
  scope :due_next_7_days, ->(today) { active.scheduled.where(next_review_date: (today + 1)..(today + 7)) }
  # The notes with no review schedule, the interval none, in any status
  # (features/17_search_and_filter question 8).
  scope :unscheduled, -> { where(review_interval: "none") }
  # The notes whose title, body, or source URL contains the text, each field on its own
  # (features/17_search_and_filter questions 4 and 13). The text is folded as the copies are,
  # and instr takes it as it is, so % and _ match as themselves (question 6).
  scope :matching, ->(text) {
    where(
      "instr(notes.search_title, :text) > 0 OR instr(notes.search_body, :text) > 0 OR instr(notes.search_source_url, :text) > 0",
      text: Note.fold_for_search(text)
    )
  }

  # The note's collection is not one of its user's collections: another user's, or one
  # that does not exist (any longer). The API sends the code not_found.
  def add_collection_not_found_error
    errors.add(:collection_id, :not_found, message: "is not one of the user's collections")
  end

  private

    # The days belong only to the custom interval, and the interval none has no next
    # review date. The last reviewed date stays (features/12_review_interval_setting
    # questions 11, 12, and 15).
    def drop_unused_schedule_values
      self.review_interval_days = nil unless review_interval == "custom"
      self.next_review_date = nil if review_interval == "none"
    end

    # A missing date of a schedule is the user's today plus the interval
    # (features/12_review_interval_setting question 8). A given date is kept.
    def schedule_from_today
      self.next_review_date ||= review_date_after(user.today)
    end

    # A copy equal to the stored one is not written, so a save that changes nothing else
    # still changes nothing, its updated date included.
    def set_search_copies
      self.search_title = Note.fold_for_search(title)
      self.search_body = Note.fold_for_search(body)
      self.search_source_url = Note.fold_for_search(source_url)
    end

    # The date one interval after the given date (requirements.md 3.5), or nil for none.
    # A month later is the same day number, or that month's last day when it has no such
    # day: Jan 31 gives Feb 28, or Feb 29 in a leap year (spec question 6).
    def review_date_after(date)
      case review_interval
      when "daily" then date + 1
      when "weekly" then date + 7
      when "monthly" then date.next_month
      when "custom" then date + review_interval_days
      end
    end

    def status_known
      errors.add(:status, :invalid) unless STATUSES.include?(status)
    end

    # Any other value is invalid, null and values that are not text included
    # (features/12_review_interval_setting question 12).
    def review_interval_known
      errors.add(:review_interval, :invalid) unless REVIEW_INTERVALS.include?(review_interval)
    end

    # The custom interval needs its days: a JSON integer from 1 to 365 (features/12_review_interval_setting
    # questions 5 and 12). The value is checked as sent, because Active Record would turn "7",
    # 7.0, and 1.5 into whole numbers. A value read back from the database is an Integer.
    def custom_days_whole
      return unless review_interval == "custom"

      days = review_interval_days_before_type_cast
      if days.nil?
        errors.add(:review_interval_days, :blank)
      elsif !(days.is_a?(Integer) && days.between?(1, 365))
        errors.add(:review_interval_days, :invalid)
      end
    end

    # A next review date is a real calendar date written YYYY-MM-DD (features/12_review_interval_setting
    # questions 2 and 12). The value is checked as sent, because Active Record reads "20261109"
    # as a date and turns "2026-02-30" or "tomorrow" into nil with no error. A Date passes, and
    # so does a value read back from the database. None has no date: it was dropped before.
    def next_review_date_real
      date = next_review_date_before_type_cast
      return if date.nil? || date.is_a?(Date)

      written = date.is_a?(String) && date.match?(/\A\d{4}-\d{2}-\d{2}\z/)
      errors.add(:next_review_date, :invalid) unless written && Date.valid_date?(*date.split("-").map(&:to_i))
    end

    # The tags a request named (features/10_note_tags). Each must be one of the user's
    # tags: another user's, a deleted one, or an id that is not a whole number answers
    # the same way, not_found, and the note is refused as a whole (spec question 5).
    # A tag_ids that is not a list (text, a number, an object) is invalid (spec edge case).
    def tag_ids_list
      errors.add(:tag_ids, :invalid) if tag_ids_not_a_list
    end

    def tags_of_the_user
      return if requested_tag_ids.nil? || tag_ids_not_a_list

      whole = requested_tag_ids.select { |id| id.is_a?(Integer) }
      found = user&.tags&.where(id: whole)&.pluck(:id) || []
      errors.add(:tag_ids, :not_found) unless (requested_tag_ids - found).empty?
    end

    # A note goes only into one of its user's collections. Another user's collection
    # answers like one that does not exist, so an answer never tells whether it exists
    # (spec question 8).
    def collection_of_the_user
      if collection_id.nil?
        errors.add(:collection_id, :blank)
      elsif collection&.user_id != user_id
        add_collection_not_found_error
      end
    end
end

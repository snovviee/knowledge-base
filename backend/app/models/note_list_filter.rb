# The search and the filters of the notes list, read from the list request's query
# parameters (features/15_review_due_today question 4; features/17_search_and_filter question
# 12): search, collection_id, tag_id, status, and review, each optional. They are checked as a
# record's fields are, so one 422 names every parameter that breaks a rule, through
# render_validation_failed: { "error": "validation_failed", "fields": { "review": "invalid" } }.
# collection_id and tag_id never fail. today is the user's today, read once for the request.
class NoteListFilter
  include ActiveModel::Validations

  # The values of review, written exactly so, in lower case (features/15_review_due_today
  # question 10): due today (feature 15), overdue (features/16_review_overdue question 2), and
  # the next 7 days and no review scheduled (features/17_search_and_filter questions 7 and 8).
  REVIEW_STATES = %w[due_today overdue next_7_days unscheduled].freeze
  # The longest search, counted after tidying (features/17_search_and_filter questions 6 and 13).
  SEARCH_MAX_LENGTH = 2000

  validate :search_text
  validate :status_known
  validate :review_known

  def initialize(params, today)
    @search = params[:search]
    @collection_id = params[:collection_id]
    @tag_id = params[:tag_id]
    @status = params[:status]
    @review = params[:review]
    @today = today
  end

  # The notes of the relation that the search and every filter keep, all of them at once
  # (features/17_search_and_filter question 2). A parameter left out or empty does not filter,
  # and neither does a search of only whitespace (question 13).
  def apply(notes)
    notes = notes.matching(search) if search.present?
    notes = in_collection(notes) unless empty?(collection_id)
    notes = with_tag(notes) unless empty?(tag_id)
    notes = notes.where(status: status) unless empty?(status)
    in_review_state(notes)
  end

  private

    attr_reader :search, :collection_id, :tag_id, :status, :review, :today

    # Left out or empty: the parameter does not filter (features/15_review_due_today question 10).
    def empty?(value)
      value.nil? || value == ""
    end

    # The id a parameter names: a whole number written in digits, or nil for any other value.
    def whole_number(value)
      value.to_i if value.is_a?(String) && value.match?(/\A\d+\z/)
    end

    # The notes in the collection with this id. Another user's collection, a deleted one, or a
    # value that is not a whole number keeps no note, so an answer never tells whether another
    # user's collection exists (features/17_search_and_filter question 9).
    def in_collection(notes)
      id = whole_number(collection_id)
      id ? notes.where(collection_id: id) : notes.none
    end

    # The notes with the tag with this id, the same way: another user's tag, a deleted one, or
    # a value that is not a whole number keeps no note (features/17_search_and_filter question 9).
    def with_tag(notes)
      id = whole_number(tag_id)
      id ? notes.where(id: NoteTag.where(tag_id: id).select(:note_id)) : notes.none
    end

    # The notes in the review state that review names, each kept by its Note scope.
    def in_review_state(notes)
      case review
      when "due_today" then notes.due_today(today)
      when "overdue" then notes.overdue(today)
      when "next_7_days" then notes.due_next_7_days(today)
      when "unscheduled" then notes.unscheduled
      else notes
      end
    end

    # A search that is not text, such as a list (search[]=rails) or an object (search[a]=b), is
    # invalid (features/17_search_and_filter question 18). One longer than the limit after
    # tidying (the ends trimmed, each run of whitespace one space) is too_long (questions 6, 13).
    def search_text
      return if search.nil?
      return errors.add(:search, :invalid) unless search.is_a?(String)

      errors.add(:search, :too_long) if search.squish.length > SEARCH_MAX_LENGTH
    end

    # Left out or empty is no filter. Any value other than active or archived is invalid,
    # another letter case and a value that is not text included (features/17_search_and_filter
    # questions 9 and 12).
    def status_known
      return if empty?(status)

      errors.add(:status, :invalid) unless Note::STATUSES.include?(status)
    end

    # Left out or empty is no filter. Any other value is invalid: one no feature defines,
    # another letter case, or a value that is not text, such as a list (review[]=due_today).
    def review_known
      return if empty?(review)

      errors.add(:review, :invalid) unless REVIEW_STATES.include?(review)
    end
end

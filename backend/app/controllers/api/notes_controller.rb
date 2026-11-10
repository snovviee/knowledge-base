module Api
  # The signed-in user's notes (features/09_notes_crud). Every lookup goes through
  # current_user, so another user's notes are never reached.
  class NotesController < ApplicationController
    # No sign-in answers 401 before the anti-forgery check, with or without a token
    # (features/06_collections_crud question 4).
    prepend_before_action :require_signed_in_user

    # A note change sends the user's new review reminders batch to their open connections
    # (features/20_realtime_notifications question 5).
    include SendsReviewReminders
    after_action :send_review_reminders, only: %i[create update destroy review]

    # The list, newest first, with only the notes its search and filters keep. One 422 names
    # every parameter the server refuses (features/15_review_due_today questions 4 and 10;
    # features/17_search_and_filter questions 2, 9, and 12).
    def index
      filter = NoteListFilter.new(params, today)
      return render_validation_failed(filter) if filter.invalid?

      notes = filter.apply(current_user.notes).newest_first.includes(:collection, :tags)
      render json: { notes: notes.map { |note| summary_json(note) } }
    end

    def show
      render json: { note: note_json(current_user.notes.find(params[:id])) }
    end

    # A new note is active: a status in the body is ignored, and so is a user id. The
    # source URL is assigned as sent: a value that is not text becomes text that is
    # never a web address, so it is invalid (spec question 8).
    def create
      note = current_user.notes.new(
        title: text_param(:title), body: text_param(:body), source_url: params[:source_url], collection_id: collection_id_param,
        **review_attributes
      )

      note.requested_tag_ids = requested_tag_ids
      note.tag_ids_not_a_list = tag_ids_not_a_list?

      if save_with_tags(note) { note.save }
        render json: { note: note_json(note) }, status: :created
      else
        render_validation_failed(note)
      end
    rescue ActiveRecord::InvalidForeignKey
      render_refused_row(note)
    end

    def update
      note = current_user.notes.find(params[:id])
      note.requested_tag_ids = requested_tag_ids
      note.tag_ids_not_a_list = tag_ids_not_a_list?

      if save_with_tags(note) { note.update(edited_attributes) }
        render json: { note: note_json(note) }
      else
        render_validation_failed(note)
      end
    rescue ActiveRecord::InvalidForeignKey
      # A move whose collection was deleted after the check passed
      # (features/11_note_move): it answers as a create does.
      render_refused_row(note)
    end

    def destroy
      current_user.notes.find(params[:id]).destroy!
      head :no_content
    end

    # Marks the note as reviewed today (features/13_mark_reviewed): any note of the user,
    # archived or unscheduled included, on any day (spec questions 1 and 3). Only the id is
    # read: a body is ignored, so a client cannot choose the date (question 4). The answer
    # is the note's detail, as GET /api/notes/:id gives it.
    def review
      note = current_user.notes.find(params[:id])
      note.mark_reviewed!
      render json: { note: note_json(note) }
    end

    private

      # Saves the note (the block) and writes the tags the request sent, in one transaction
      # (features/10_note_tags question 5: a refused request changes nothing). A tag deleted
      # after its check is a new, unsaved Tag in set_tags, which fails its own checks
      # (ActiveRecord::RecordInvalid) before any link is written. The error leaves the
      # transaction, which rolls the note's row back too, and the answer is tag_ids not_found.
      # A row the database refuses (InvalidForeignKey) rolls back the same way, and the
      # action answers it with render_refused_row.
      def save_with_tags(note)
        Note.transaction { yield && (requested_tag_ids.nil? || set_tags(note)) }
      rescue ActiveRecord::RecordInvalid
        note.errors.add(:tag_ids, :not_found)
        false
      end

      # The database refused the note's row: its collection was deleted after the check
      # passed. That answers like a collection that does not exist (features/09_notes_crud
      # spec edge case; features/11_note_move). A tag deleted after its check answers the
      # same way for tag_ids (features/10_note_tags).
      def render_refused_row(note)
        if note.collection_id.present? && !current_user.collections.exists?(note.collection_id)
          note.add_collection_not_found_error
        else
          note.errors.add(:tag_ids, :not_found)
        end
        render_validation_failed(note)
      end

      # Only text is a title or a body. Anything else (a number, a list, an object)
      # counts as none, so it is blank (spec question 8).
      def text_param(key)
        params[key] if params[key].is_a?(String)
      end

      # Only the fields the request sends change (spec question 9): an archive sends
      # only { "status": "archived" }, and a restore { "status": "active" }. The source
      # URL and the status are assigned as sent, so a value that is not text is invalid.
      # A collection_id moves the note (features/11_note_move), read as the create reads it.
      # The review fields are read as the create reads them (features/12_review_interval_setting).
      def edited_attributes
        attributes = {}
        attributes[:title] = text_param(:title) if params.key?(:title)
        attributes[:body] = text_param(:body) if params.key?(:body)
        attributes[:source_url] = params[:source_url] if params.key?(:source_url)
        attributes[:status] = params[:status] if params.key?(:status)
        attributes[:collection_id] = collection_id_param if params.key?(:collection_id)
        attributes.merge(review_attributes)
      end

      # The review schedule fields that the body has, as sent: the model checks the raw values
      # (features/12_review_interval_setting questions 5 and 12). A field the body does not
      # have is left as it is, so a new note's interval is none and an edit changes only what
      # it sends. A last_reviewed_date in the body is never read (question 15).
      def review_attributes
        attributes = {}
        attributes[:review_interval] = params[:review_interval] if params.key?(:review_interval)
        attributes[:review_interval_days] = params[:review_interval_days] if params.key?(:review_interval_days)
        attributes[:next_review_date] = params[:next_review_date] if params.key?(:next_review_date)
        attributes
      end

      # The ids the request sent in tag_ids, as whole numbers (features/10_note_tags). A
      # request with no tag_ids has nil here, and the tags stay as they are.
      # Sets the note's tags to the requested set. The note's updated date changes only
      # when the set changes (spec question 4): a set that is the same changes nothing.
      # The tags the request named were found by the check, so the write links those
      # exact rows. A tag deleted since the check has no row to link, and the link is
      # refused, rather than being dropped from the set (spec: a race with a tag delete).
      def set_tags(note)
        wanted = requested_tag_ids.map { |id| Tag.find_by(id: id, user_id: current_user.id) || Tag.new(id: id) }
        return true if note.tags.sort_by(&:id) == wanted.sort_by(&:id)

        note.tags = wanted
        note.save!
        note.touch
        true
      end

      # True when tag_ids is sent and is not a list (spec edge case: 422 invalid).
      def tag_ids_not_a_list?
        params.key?(:tag_ids) && !params[:tag_ids].is_a?(Array)
      end

      # Only a whole number is an id. Anything else (1.5, "abc", null, an object) stays as
      # it is, so the lookup finds no tag for it and it is refused as not_found.
      def requested_tag_ids
        return nil unless params.key?(:tag_ids)
        Array(params[:tag_ids]).map { |id| id.is_a?(Integer) ? id : [ :not_a_whole_number, id ] }.uniq
      end

      # A collection's id is a whole number. Missing or null is none (blank). Any other
      # value becomes 0, which no collection has, so it is not_found (spec question 8):
      # left to Active Model, "abc" would become 0 but [1] nil, and 1.5 would become 1.
      def collection_id_param
        value = params[:collection_id]
        value.nil? || value.is_a?(Integer) ? value : 0
      end

      # The user's today, read once for the request, so every note of an answer is judged on
      # the same date (features/15_review_due_today; features/12_review_interval_setting question 1).
      def today
        @today ||= current_user.today
      end

      # The whole note, for its detail (requirements.md 4: the note detail view).
      def note_json(note)
        summary_json(note).merge(body: note.body, source_url: note.source_url)
      end

      # What the list shows of a note (requirements.md 4: the notes view). The review
      # dates are calendar dates, "2026-11-16" (features/12_review_interval_setting
      # questions 2 and 15). The review state is "due_today", "overdue", or nil on the
      # user's today, in every answer that has a note (features/15_review_due_today question 2).
      def summary_json(note)
        {
          id: note.id,
          title: note.title,
          status: note.status,
          collection: { id: note.collection.id, name: note.collection.name },
          tags: note.tags.alphabetical.map { |tag| { id: tag.id, name: tag.name } },
          review_interval: note.review_interval,
          review_interval_days: note.review_interval_days,
          next_review_date: note.next_review_date,
          last_reviewed_date: note.last_reviewed_date,
          review_state: note.review_state(today),
          created_at: note.created_at,
          updated_at: note.updated_at
        }
      end
  end
end

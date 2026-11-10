module Api
  # The signed-in user's collections (features/06_collections_crud). Every lookup
  # goes through current_user, so another user's collections are never reached.
  class CollectionsController < ApplicationController
    # No sign-in answers 401 before the anti-forgery check, with or without a token
    # (spec question 4).
    prepend_before_action :require_signed_in_user

    # A rename sends the user's new review reminders batch, which shows the collection's new
    # name (features/20_realtime_notifications question 5). A new collection has no notes,
    # and a collection with notes cannot be deleted, so neither changes a reminder.
    include SendsReviewReminders
    after_action :send_review_reminders, only: :update

    def index
      collections = current_user.collections.alphabetical
      render json: { collections: collections.map { |collection| collection_json(collection) } }
    end

    def create
      collection = current_user.collections.new(name: name_param)

      if collection.save
        render json: { collection: collection_json(collection) }, status: :created
      else
        render_validation_failed(collection)
      end
    rescue ActiveRecord::RecordNotUnique
      render_name_taken(collection)
    end

    def update
      collection = current_user.collections.find(params[:id])

      if collection.update(name: name_param)
        render json: { collection: collection_json(collection) }
      else
        render_validation_failed(collection)
      end
    rescue ActiveRecord::RecordNotUnique
      render_name_taken(collection)
    end

    # Deletes the collection. What a delete does to its notes is AC-07
    # (features/07_collection_delete_rule). Until feature 07 decides, the notes' foreign
    # key refuses to delete a collection that has notes, so no note is lost or left
    # without a collection (features/09_notes_crud question 15).
    def destroy
      current_user.collections.find(params[:id]).destroy!
      head :no_content
    rescue ActiveRecord::InvalidForeignKey
      render json: { error: "collection_not_empty" }, status: :conflict
    end

    private

      # Only a string is a name. Anything else (a number, a list, an object) counts
      # as no name, so the answer is blank (spec question 1).
      def name_param
        params[:name] if params[:name].is_a?(String)
      end

      # Two creates or renames to the same name at the same moment: both passed the
      # check, and the unique index refused the second row. That answers like a
      # taken name.
      def render_name_taken(collection)
        collection.errors.add(:name, :taken)
        render_validation_failed(collection)
      end

      def collection_json(collection)
        { id: collection.id, name: collection.name }
      end
  end
end

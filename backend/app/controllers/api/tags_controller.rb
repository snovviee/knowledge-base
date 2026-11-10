module Api
  # The signed-in user's tags (features/08_tags_crud). Every lookup goes through
  # current_user, so another user's tags are never reached.
  class TagsController < ApplicationController
    # No sign-in answers 401 before the anti-forgery check, with or without a token
    # (features/06_collections_crud question 4).
    prepend_before_action :require_signed_in_user

    def index
      tags = current_user.tags.alphabetical
      render json: { tags: tags.map { |tag| tag_json(tag) } }
    end

    def create
      tag = current_user.tags.new(name: name_param)

      if tag.save
        render json: { tag: tag_json(tag) }, status: :created
      else
        render_validation_failed(tag)
      end
    rescue ActiveRecord::RecordNotUnique
      render_name_taken(tag)
    end

    def update
      tag = current_user.tags.find(params[:id])

      if tag.update(name: name_param)
        render json: { tag: tag_json(tag) }
      else
        render_validation_failed(tag)
      end
    rescue ActiveRecord::RecordNotUnique
      render_name_taken(tag)
    end

    # Deletes only the tag. Notes do not exist yet: taking a deleted tag off its notes,
    # which stay, is AC-10 (features/10_note_tags).
    def destroy
      current_user.tags.find(params[:id]).destroy!
      head :no_content
    end

    private

      # Only a string is a name. Anything else (a number, a list, an object) counts
      # as no name, so the answer is blank (features/06_collections_crud question 1).
      def name_param
        params[:name] if params[:name].is_a?(String)
      end

      # Two creates or renames to the same name at the same moment: both passed the
      # check, and the unique index refused the second row. That answers like a
      # taken name.
      def render_name_taken(tag)
        tag.errors.add(:name, :taken)
        render_validation_failed(tag)
      end

      def tag_json(tag)
        { id: tag.id, name: tag.name }
      end
  end
end

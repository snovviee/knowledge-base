require_relative "request_helpers"

# Helpers for the privacy checks across accounts (features/21_data_privacy), in the request
# specs and the channel specs.
module PrivacyHelpers
  include RequestHelpers

  # Everything of the user's workspace, read from the database: the user's row (the saved time
  # zone and the profile), the sign-ins, and every column of the collections, tags, and notes,
  # each ordered by id, the links of the user's notes and tags, and the review dismissals the
  # user made or that name the user's notes (features/23_websocket_client_message). A refused
  # request leaves it equal, updated_at included.
  def workspace_of(user)
    user = User.find(user.id)
    links = NoteTag.where(note_id: user.notes.select(:id)).or(NoteTag.where(tag_id: user.tags.select(:id)))
    dismissals = ReviewDismissal.where(user_id: user.id).or(ReviewDismissal.where(note_id: user.notes.select(:id)))
    {
      user: user.attributes,
      sign_ins: user.sign_ins.order(:id).map(&:attributes),
      collections: user.collections.order(:id).map(&:attributes),
      tags: user.tags.order(:id).map(&:attributes),
      notes: user.notes.order(:id).map(&:attributes),
      note_tags: links.order(:note_id, :tag_id).pluck(:note_id, :tag_id),
      review_dismissals: dismissals.order(:id).map(&:attributes)
    }
  end

  # No batch on the user's stream of review reminders (features/20_realtime_notifications), through
  # the test adapter of config/cable.yml. It counts exactly none: the matcher's negation would
  # also pass for two batches.
  def no_batch_to(user)
    have_broadcasted_to(user).from_channel(ReviewRemindersChannel).exactly(0)
  end

  # Sends a request as the app does: the body as JSON, with the browser's own anti-forgery token
  # from GET /api/csrf in X-CSRF-Token, as log_out (spec/support/cable_helpers.rb) does. A String
  # body is sent as it is, so a test can send a body that is not JSON. A header given as nil is
  # left out: "X-CSRF-Token" => nil sends no token. Returns the browser's response.
  def send_json(browser, method, path, body = nil, headers = {})
    headers = { "X-CSRF-Token" => csrf_token(browser), "Content-Type" => "application/json" }.merge(headers).compact
    body = body.to_json unless body.nil? || body.is_a?(String)
    browser.public_send(method.to_s.downcase, path, params: body, headers: headers)
    browser.response
  end
end

RSpec.configure do |config|
  config.include PrivacyHelpers, type: :request
  config.include PrivacyHelpers, type: :channel
end

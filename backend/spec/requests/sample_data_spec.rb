require "rails_helper"

# features/26_local_run. The sample data covers every review state that features 15 to 17
# define (spec question 10), read through the app's own API, so the states follow the app's
# definitions: review_state (features 15 and 16) and the review filter's next_7_days and
# unscheduled (feature 17). A browser signs in through the real callback
# (spec/support/request_helpers.rb) and reports its zone, as the app does. The time is fixed
# at 2026-11-09 20:00 UTC, an hour where the zone changes the date: in Tokyo it is 2026-11-10.
RSpec.describe "Sample data review states", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  after { travel_back }

  # The notes that GET /api/notes answers for the query, which must answer 200.
  def notes_listed(query = "")
    get "/api/notes#{query}"
    expect(response).to have_http_status(:ok)
    JSON.parse(response.body)["notes"]
  end

  it "AC-26 the sample data covers every review state, counted from the user's today" do
    travel_to Time.utc(2026, 11, 9, 20, 0)
    sign_in_with_google
    # The session check saves the browser's zone (features/12_review_interval_setting question 1).
    get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }
    SampleData.load!

    notes = notes_listed
    expect(notes.map { |note| note["review_state"] }).to include("overdue", "due_today")
    expect(notes_listed("?review=next_7_days")).not_to be_empty
    expect(notes_listed("?review=unscheduled")).not_to be_empty
    # Due later: an active note with a schedule, dated after today plus 7 days in Tokyo.
    due_later = notes.select do |note|
      note["status"] == "active" && note["review_interval"] != "none" && note["next_review_date"] > "2026-11-17"
    end
    expect(due_later).not_to be_empty

    # One day on, the notes that were due today are overdue.
    due_today = notes.select { |note| note["review_state"] == "due_today" }.map { |note| note["title"] }
    travel_to Time.utc(2026, 11, 10, 20, 0)
    states = notes_listed.to_h { |note| [ note["title"], note["review_state"] ] }

    expect(states.slice(*due_today).values).to all(eq("overdue"))
  end
end

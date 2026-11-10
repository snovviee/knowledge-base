require "rails_helper"

# Every route under /api, as method and path, PATCH and PUT both (features/21_data_privacy). The
# tables of the checks below are built from it: the 401 table walks every route, and the address
# table every route with :id. The route guard fails for a route of the app that is not here, so a
# feature that adds a route under /api adds it here, and its 401 and address checks come with it.
API_ROUTES = [
  [ "GET", "/api/csrf" ],
  [ "GET", "/api/session" ],
  [ "DELETE", "/api/session" ],
  [ "GET", "/api/collections" ],
  [ "POST", "/api/collections" ],
  [ "PATCH", "/api/collections/:id" ],
  [ "PUT", "/api/collections/:id" ],
  [ "DELETE", "/api/collections/:id" ],
  [ "GET", "/api/tags" ],
  [ "POST", "/api/tags" ],
  [ "PATCH", "/api/tags/:id" ],
  [ "PUT", "/api/tags/:id" ],
  [ "DELETE", "/api/tags/:id" ],
  [ "GET", "/api/notes" ],
  [ "POST", "/api/notes" ],
  [ "GET", "/api/notes/:id" ],
  [ "PATCH", "/api/notes/:id" ],
  [ "PUT", "/api/notes/:id" ],
  [ "DELETE", "/api/notes/:id" ],
  [ "POST", "/api/notes/:id/review" ]
].freeze

# features/21_data_privacy. Each user reaches only their own data (requirements.md 1, 5, and 7).
# Two users sign in through the real callbacks, each in a browser of its own: me ("Ada Lovelace",
# Google) and the other user ("Grace Hopper", GitHub). Apart from Cache-Control, every behavior
# checked here was built by an earlier feature; these tests check it across the whole API (plan,
# Deviations). The time is fixed at 2026-11-09 20:00 UTC. Neither user has a saved zone unless a
# test gives one, so today is 2026-11-09 for both.
#
# workspace_of, send_json, and no_batch_to come from spec/support/privacy_helpers.rb.
RSpec.describe "Data privacy", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:today) { Date.new(2026, 11, 9) }
  # My browser and the other user's, each with cookies of its own.
  let(:my_browser) { open_session }
  let(:their_browser) { open_session }
  let(:me) { User.find_by!(provider: "google_oauth2", provider_user_id: "u-1") }
  let(:other) { User.find_by!(provider: "github", provider_user_id: "g-1") }
  # The other user's records that the routes with :id name, by the kind in their path, found once
  # before any request.
  let(:their_records) do
    {
      "collections" => collection_named(other, "Secret"),
      "tags" => tag_named(other, "private"),
      "notes" => note_titled(other, "Secret plan")
    }
  end

  before do
    travel_to Time.utc(2026, 11, 9, 20, 0)
    sign_in_with_google(my_browser, uid: "u-1", name: "Ada Lovelace")
    sign_in_through(:github, their_browser, uid: "g-1", name: "Grace Hopper")

    # My workspace, then theirs, so each of their records has the id right after my newest one of
    # its kind: "Secret" after "Books", "private" after "ruby", and "Secret plan" after "Plan B".
    # Each user has a note due today, an overdue one, one due in the next 7 days, and one with no
    # review scheduled.
    work = me.collections.create!(name: "Work")
    books = me.collections.create!(name: "Books")
    ruby = me.tags.create!(name: "ruby")
    note_for(me, "Someday", books)
    note_for(me, "Later", books, review_interval: "weekly", next_review_date: today + 3)
    note_for(me, "Old idea", books, review_interval: "weekly", next_review_date: today - 7)
    note_for(me, "Rails tips", work, review_interval: "weekly", next_review_date: today).add_tag(ruby)
    note_for(me, "Plan B", work)

    secret = other.collections.create!(name: "Secret")
    private_tag = other.tags.create!(name: "private")
    note_for(other, "Secret plan", secret, review_interval: "weekly", next_review_date: today).add_tag(private_tag)
    note_for(other, "Secret old", secret, review_interval: "weekly", next_review_date: today - 3)
    note_for(other, "Secret soon", secret, review_interval: "weekly", next_review_date: today + 2)
    note_for(other, "Secret idea", secret)
  end

  after do
    travel_back
    OmniAuth.config.mock_auth[:github] = nil
  end

  # Signs the browser in through the provider's real callback (OmniAuth test mode), as
  # sign_in_with_google (spec/support/request_helpers.rb) does, with an email when one is given.
  def sign_in_through(provider, browser, uid:, name:, email: nil)
    OmniAuth.config.mock_auth[provider] = OmniAuth::AuthHash.new(
      provider: provider.to_s, uid: uid, info: { name: name, email: email }
    )
    browser.get "/auth/#{provider}/callback"
  end

  # A note of the user in the collection, with the review fields given.
  def note_for(user, title, collection, **fields)
    user.notes.create!(collection: collection, title: title, body: "Body of #{title}", **fields)
  end

  def collection_named(user, name)
    user.collections.find_by!(name: name)
  end

  def tag_named(user, name)
    user.tags.find_by!(name: name)
  end

  def note_titled(user, title)
    user.notes.find_by!(title: title)
  end

  # The other user's record that a route with :id names. A route of another kind fails here until
  # its record is added to their_records.
  def their_record_for(path)
    their_records.fetch(path.split("/")[2])
  end

  # The ids in the browser's list: GET /api/collections, /api/tags, or /api/notes.
  def listed_ids(browser, list, query = {})
    browser.get "/api/#{list}", params: query
    JSON.parse(browser.response.body).fetch(list).map { |record| record["id"] }
  end

  # Every name in the user's workspace: the display name, the names of the collections and tags,
  # and the titles of the notes.
  def names_of(user)
    [ user.display_name ] + user.collections.pluck(:name) + user.tags.pluck(:name) + user.notes.pluck(:title)
  end

  # An answer as [its status, its body]: the JSON read, nil when empty, else the text as is.
  def answer_of(response)
    [ response.status, response.body.empty? ? nil : JSON.parse(response.body) ]
  rescue JSON::ParserError
    [ response.status, response.body ]
  end

  # The failure message of a table test: each request whose answer differs, on a line of its own,
  # so none is cut off.
  def every_line(wrong)
    "expected every answer to be right, but these were not:\n#{wrong.join("\n")}"
  end

  # One answer of each status the API gives (spec question 3), as [the request, the status it
  # should get, the response], in the order they are sent: my reads and changes, a browser with no
  # sign-in, and my logout, twice, the second time with no sign-in left.
  def answers_of_every_kind
    answers = []
    answer = ->(request, status, browser = my_browser) { answers << [ request, status, browser.response ] }
    stranger = open_session

    my_browser.get "/api/csrf"
    answer.call("GET /api/csrf", 200)
    my_browser.get "/api/session"
    answer.call("GET /api/session", 200)
    stranger.get "/api/session"
    answer.call("GET /api/session with no sign-in", 401, stranger)
    %w[collections tags notes].each do |list|
      my_browser.get "/api/#{list}"
      answer.call("GET /api/#{list}", 200)
    end
    my_browser.get "/api/notes/#{note_titled(me, 'Plan B').id}"
    answer.call("GET /api/notes/:id", 200)

    send_json(my_browser, :post, "/api/collections", { name: "Temp" })
    answer.call("POST /api/collections", 201)
    send_json(my_browser, :post, "/api/collections", { name: "" })
    answer.call("POST /api/collections with no name", 422)
    send_json(my_browser, :post, "/api/collections", { name: "X" }, "X-CSRF-Token" => nil)
    answer.call("POST /api/collections with no token", 403)
    send_json(my_browser, :post, "/api/collections", "{oops")
    answer.call("POST /api/collections with a body that is not JSON", 400)
    send_json(my_browser, :patch, "/api/collections/#{Collection.maximum(:id) + 1000}", { name: "Y" })
    answer.call("PATCH /api/collections/:id of a missing collection", 404)
    send_json(my_browser, :delete, "/api/collections/#{collection_named(me, 'Work').id}")
    answer.call("DELETE /api/collections/:id of a collection with notes", 409)
    send_json(my_browser, :post, "/api/notes/#{note_titled(me, 'Old idea').id}/review")
    answer.call("POST /api/notes/:id/review", 200)
    send_json(my_browser, :delete, "/api/notes/#{note_titled(me, 'Someday').id}")
    answer.call("DELETE /api/notes/:id", 204)

    send_json(my_browser, :delete, "/api/session")
    answer.call("DELETE /api/session", 204)
    send_json(my_browser, :delete, "/api/session")
    answer.call("DELETE /api/session with no sign-in", 204)
    answers
  end

  it "AC-21 every answer of the API carries Cache-Control no-store, success and error alike" do
    wrong = answers_of_every_kind.filter_map do |request, status, response|
      answer = [ response.status, response.headers["Cache-Control"] ]
      "#{request}: #{answer}" unless answer == [ status, "no-store" ]
    end

    expect(wrong).to be_empty, every_line(wrong)
  end

  it "AC-21 every API route is in the privacy checks and no route lists users" do
    routes = Rails.application.routes.routes.filter_map do |route|
      path = route.path.spec.to_s.delete_suffix("(.:format)")
      [ route.verb, path ] if path.start_with?("/api")
    end

    aggregate_failures do
      expect(routes).to match_array(API_ROUTES)
      # No sharing of any kind: no route names users or accounts (spec edge case).
      expect(routes.flat_map { |_verb, path| path.split("/") }.grep(/user|account/i)).to be_empty
    end
  end

  it "AC-21 with no sign-in every API endpoint that reaches a user's data answers 401 before any other check" do
    workspaces = [ workspace_of(me), workspace_of(other) ]
    # The two routes that reach no user's data, and their answers.
    open_routes = { [ "GET", "/api/csrf" ] => 200, [ "DELETE", "/api/session" ] => 204 }
    stranger = open_session

    wrong = API_ROUTES.filter_map do |verb, path|
      # No token, a body that is not JSON (a GET sends none), and the other user's record.
      address = path.include?(":id") ? path.sub(":id", their_record_for(path).id.to_s) : path
      send_json(stranger, verb, address, ("{oops" unless verb == "GET"), "X-CSRF-Token" => nil)
      answer = answer_of(stranger.response)
      status = open_routes[[ verb, path ]]
      next if status ? answer.first == status : answer == [ 401, { "error" => "unauthenticated" } ]

      "#{verb} #{address}: #{answer}"
    end

    expect(wrong).to be_empty, every_line(wrong)
    expect([ workspace_of(me), workspace_of(other) ]).to eq(workspaces)
  end

  it "AC-21 the collections, tags, and notes lists hold only the signed-in user's records" do
    wrong = []

    [ [ my_browser, me, other ], [ their_browser, other, me ] ].each do |browser, user, stranger|
      bodies = %w[collections tags notes].map do |list|
        ids = listed_ids(browser, list)
        wrong << "#{user.display_name}'s #{list}: #{ids}" unless ids.sort == user.public_send(list).ids.sort
        browser.response.body
      end
      browser.get "/api/session"
      session = JSON.parse(browser.response.body)
      wrong << "#{user.display_name}'s session: #{session}" unless session == { "user" => { "id" => user.id, "display_name" => user.display_name } }
      # Nothing of the other user in any answer: no name, title, or collection or tag name.
      leaked = names_of(stranger).select { |name| (bodies + [ browser.response.body ]).any? { |body| body.include?(name) } }
      wrong << "#{user.display_name}'s answers hold #{leaked}" if leaked.any?
    end

    expect(wrong).to be_empty, every_line(wrong)
  end

  it "AC-21 every request that names another user's record in the address answers 404 like a missing one and changes nothing" do
    # The bodies of the routes that take one: a rename, and a note's edit, archive, and restore.
    bodies = {
      [ "PATCH", "/api/collections/:id" ] => [ { name: "Mine now" } ],
      [ "PUT", "/api/collections/:id" ] => [ { name: "Mine now" } ],
      [ "PATCH", "/api/tags/:id" ] => [ { name: "Mine now" } ],
      [ "PUT", "/api/tags/:id" ] => [ { name: "Mine now" } ],
      [ "PATCH", "/api/notes/:id" ] => [ { title: "Mine now" }, { status: "archived" }, { status: "active" } ],
      [ "PUT", "/api/notes/:id" ] => [ { title: "Mine now" } ]
    }
    # Ids count up, so the id right after my newest note is a guess that finds the other user's.
    expect(me.notes.maximum(:id) + 1).to eq(note_titled(other, "Secret plan").id)
    workspaces = [ workspace_of(me), workspace_of(other) ]
    wrong = []

    expect {
      API_ROUTES.select { |_verb, path| path.include?(":id") }.each do |verb, path|
        theirs = their_record_for(path)
        # The other user's id, a guessed one (right after my newest record of the kind), a missing
        # one (the largest id of the table plus 1,000), and one that is not a number.
        guessed = me.public_send(path.split("/")[2]).maximum(:id) + 1
        ids = [ theirs.id, guessed, theirs.class.maximum(:id) + 1000, "abc" ].uniq

        ids.product(bodies.fetch([ verb, path ], [ nil ])).each do |id, body|
          address = path.sub(":id", id.to_s)
          send_json(my_browser, verb, address, body)
          answer = answer_of(my_browser.response)
          wrong << "#{verb} #{address} #{body&.to_json}: #{answer}" unless answer == [ 404, { "error" => "not_found" } ]
        end
      end
    }.to no_batch_to(me).and no_batch_to(other)

    expect(wrong).to be_empty, every_line(wrong)
    expect([ workspace_of(me), workspace_of(other) ]).to eq(workspaces)
  end

  it "AC-21 a request body that names another user's collection or tag answers 422 not_found like a missing one and changes nothing" do
    work = collection_named(me, "Work")
    ruby = tag_named(me, "ruby")
    plan_b = note_titled(me, "Plan B")
    workspaces = [ workspace_of(me), workspace_of(other) ]
    # Each body with the other user's record, a missing one, and an id that is not a number.
    collection_ids = [ collection_named(other, "Secret").id, Collection.maximum(:id) + 1000, "abc" ]
    tag_ids = [ tag_named(other, "private").id, Tag.maximum(:id) + 1000, "abc" ]
    requests = collection_ids.flat_map do |id|
      [
        [ "POST", "/api/notes", { title: "X", body: "B", collection_id: id }, "collection_id" ],
        [ "PATCH", "/api/notes/#{plan_b.id}", { collection_id: id }, "collection_id" ]
      ]
    end
    requests += tag_ids.flat_map do |id|
      [
        [ "POST", "/api/notes", { title: "X", body: "B", collection_id: work.id, tag_ids: [ ruby.id, id ] }, "tag_ids" ],
        [ "PATCH", "/api/notes/#{plan_b.id}", { title: "Changed", tag_ids: [ ruby.id, id ] }, "tag_ids" ]
      ]
    end

    wrong = requests.filter_map do |verb, path, body, field|
      send_json(my_browser, verb, path, body)
      answer = answer_of(my_browser.response)
      "#{verb} #{path} #{body.to_json}: #{answer}" unless answer == [ 422, { "error" => "validation_failed", "fields" => { field => "not_found" } } ]
    end

    expect(wrong).to be_empty, every_line(wrong)
    # Refused whole: "Plan B" keeps its title, its collection, and no tags.
    expect([ workspace_of(me), workspace_of(other) ]).to eq(workspaces)
    expect(plan_b.reload).to have_attributes(title: "Plan B", collection_id: work.id)
    expect(plan_b.tags).to be_empty
  end

  it "AC-21 a filter by another user's collection or tag finds nothing and a search or a review choice looks only in my notes" do
    # The other user's collection or tag, a missing one (the largest id of the table plus 1,000),
    # and a value that is not a number each find no note: the same answer for the three.
    filters = [ collection_named(other, "Secret").id, Collection.maximum(:id) + 1000, "abc" ].map { |id| { collection_id: id } }
    filters += [ tag_named(other, "private").id, Tag.maximum(:id) + 1000, "abc" ].map { |id| { tag_id: id } }
    wrong = filters.filter_map do |query|
      my_browser.get "/api/notes", params: query
      answer = answer_of(my_browser.response)
      "?#{query.to_query}: #{answer}" unless answer == [ 200, { "notes" => [] } ]
    end

    # The search and each review choice find only my notes, newest first, each with its review
    # state on my today. The other user has a note that matches "plan" ("Secret plan") and a note
    # in each review state.
    expected = {
      { search: "plan" } => [ [ "Plan B", nil ] ],
      { review: "due_today" } => [ [ "Rails tips", "due_today" ] ],
      { review: "overdue" } => [ [ "Old idea", "overdue" ] ],
      { review: "next_7_days" } => [ [ "Later", nil ] ],
      { review: "unscheduled" } => [ [ "Plan B", nil ], [ "Someday", nil ] ]
    }
    expected.each do |query, notes|
      my_browser.get "/api/notes", params: query
      listed = JSON.parse(my_browser.response.body)["notes"].map { |note| note.values_at("title", "review_state") }
      wrong << "?#{query.to_query}: #{my_browser.response.status} #{listed}" unless listed == notes
    end

    expect(wrong).to be_empty, every_line(wrong)
  end

  it "AC-21 marking another user's note as reviewed answers 404 and leaves its dates and its reminder as they were" do
    secret_plan = note_titled(other, "Secret plan")

    expect {
      send_json(my_browser, :post, "/api/notes/#{secret_plan.id}/review")
    }.to no_batch_to(me).and no_batch_to(other)

    expect(answer_of(my_browser.response)).to eq([ 404, { "error" => "not_found" } ])
    expect(secret_plan.reload).to have_attributes(last_reviewed_date: nil, next_review_date: today)
    # Still due today for the other user: their "Due today" list holds it, and so does their batch of
    # review reminders (features/20_realtime_notifications), where nothing dismissed it.
    their_browser.get "/api/notes", params: { review: "due_today" }
    due = JSON.parse(their_browser.response.body)["notes"].map { |note| [ note["title"], note["review_state"] ] }
    expect(due).to eq([ [ "Secret plan", "due_today" ] ])
    reminders = ReviewReminderBatch.for(other)[:reminders].map { |reminder| reminder.values_at(:title, :type) }
    expect(reminders).to eq([ [ "Secret old", "review_overdue" ], [ "Secret plan", "review_due_today" ] ])
  end

  it "AC-21 a session check saves the time zone only on the signed-in user's account and another user's zone never changes my review states" do
    # 2026-11-09 20:00 UTC is 2026-11-10 in Tokyo and 2026-11-09 in New York.
    my_browser.get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }
    note_titled(me, "Rails tips").update!(next_review_date: Date.new(2026, 11, 10))
    their_browser.get "/api/session", headers: { "X-Time-Zone" => "America/New_York" }

    expect(User.where(id: [ me.id, other.id ]).order(:id).pluck(:time_zone)).to eq([ "Asia/Tokyo", "America/New_York" ])
    my_browser.get "/api/notes"
    states = JSON.parse(my_browser.response.body)["notes"].to_h { |note| [ note["title"], note["review_state"] ] }
    expect(states).to include("Rails tips" => "due_today")
    # Each "Due today" follows its own user's today.
    due = [ my_browser, their_browser ].map do |browser|
      browser.get "/api/notes", params: { review: "due_today" }
      JSON.parse(browser.response.body)["notes"].map { |note| note["title"] }
    end
    expect(due).to eq([ [ "Rails tips" ], [ "Secret plan" ] ])
    # And so does each user's batch of review reminders (features/20_realtime_notifications), read
    # with each user's saved zone.
    batches = [ me, other ].map do |user|
      ReviewReminderBatch.for(User.find(user.id))[:reminders].map { |reminder| reminder.values_at(:title, :type) }
    end
    expect(batches).to eq([
      [ [ "Old idea", "review_overdue" ], [ "Rails tips", "review_due_today" ] ],
      [ [ "Secret old", "review_overdue" ], [ "Secret plan", "review_due_today" ] ]
    ])
  end

  it "AC-21 a session check with no sign-in answers 401 and saves no account's time zone" do
    my_browser.get "/api/session", headers: { "X-Time-Zone" => "Europe/Berlin" }
    their_browser.get "/api/session", headers: { "X-Time-Zone" => "America/New_York" }
    zones = User.order(:id).pluck(:id, :time_zone)
    expect(zones).to eq([ [ me.id, "Europe/Berlin" ], [ other.id, "America/New_York" ] ])

    stranger = open_session
    stranger.get "/api/session", headers: { "X-Time-Zone" => "Asia/Tokyo" }

    expect(answer_of(stranger.response)).to eq([ 401, { "error" => "unauthenticated" } ])
    expect(User.order(:id).pluck(:id, :time_zone)).to eq(zones)

    # My session check that names no zone keeps mine.
    my_browser.get "/api/session"

    expect(my_browser.response).to have_http_status(:ok)
    expect(User.order(:id).pluck(:id, :time_zone)).to eq(zones)
  end

  it "AC-21 a user id in a request body or a query parameter is ignored and the user comes only from the sign-in" do
    plan_b = note_titled(me, "Plan B")
    bodies = {
      "collections" => { name: "Mine" },
      "tags" => { name: "mine" },
      "notes" => { title: "Mine", body: "B", collection_id: collection_named(me, "Work").id }
    }

    created = bodies.to_h do |list, body|
      send_json(my_browser, :post, "/api/#{list}", body.merge(user_id: other.id))
      [ list, JSON.parse(my_browser.response.body).fetch(list.singularize).fetch("id") ]
    end
    send_json(my_browser, :patch, "/api/notes/#{plan_b.id}", { title: "Plan C", user_id: other.id })

    expect(my_browser.response).to have_http_status(:ok)
    expect(plan_b.reload).to have_attributes(title: "Plan C", user_id: me.id)
    created.each do |list, id|
      expect(listed_ids(my_browser, list)).to include(id)
      expect(listed_ids(their_browser, list)).not_to include(id)
    end
    # A user id in the query of a list is ignored too.
    expect(listed_ids(my_browser, "collections", user_id: other.id)).to match_array(me.collections.ids)
    expect(listed_ids(my_browser, "notes", user_id: other.id)).to match_array(me.notes.ids)
  end

  it "AC-21 no API answer gives another origin permission to read it and a preflight from another origin gets none" do
    other_site = { "Origin" => "http://localhost:8080" }
    permissions = ->(response) { response.headers.keys.grep(/\Aaccess-control-allow-/i) }
    # My browser at the app's own address. A page at http://localhost:8080 is on the same host, so
    # the browser sends my cookie (samesite=lax) with that page's requests to the app.
    browser = open_session
    browser.host! "localhost:3000"
    sign_in_with_google(browser, uid: "u-1", name: "Ada Lovelace")

    browser.get "/api/notes", headers: other_site
    expect(browser.response).to have_http_status(:ok)
    # That answer, and each answer of every kind, sent with no Origin.
    answers = [ [ "GET /api/notes from another origin", browser.response ] ]
    answers += answers_of_every_kind.map { |request, _status, response| [ request, response ] }
    wrong = answers.filter_map { |request, response| "#{request}: #{permissions.call(response)}" if permissions.call(response).any? }
    # The preflights of a change and of a session check that names a zone: no permission, so the
    # browser sends neither request.
    preflights = {
      "/api/notes" => { "Access-Control-Request-Method" => "POST", "Access-Control-Request-Headers" => "x-csrf-token, content-type" },
      "/api/session" => { "Access-Control-Request-Method" => "GET", "Access-Control-Request-Headers" => "x-time-zone" }
    }
    preflights.each do |path, request_headers|
      browser.process(:options, path, headers: other_site.merge(request_headers))
      answer = browser.response
      wrong << "OPTIONS #{path}: #{answer.status} #{permissions.call(answer)}" if answer.successful? || permissions.call(answer).any?
    end

    expect(wrong).to be_empty, every_line(wrong)
    # The WebSocket from that page, with my cookie: 404, and no connection (features/22_websocket_auth).
    browser.get "/cable", headers: other_site.merge(
      "Connection" => "Upgrade", "Upgrade" => "websocket",
      "Sec-WebSocket-Version" => "13", "Sec-WebSocket-Key" => "dGhlIHNhbXBsZSBub25jZQ=="
    )
    expect(answer_of(browser.response)).to eq([ 404, "Page not found" ])
    expect(ActionCable.server.connections).to be_empty
  end

  it "AC-21 a Google account and a GitHub account with the same email are two users with separate workspaces" do
    google = open_session
    github = open_session
    sign_in_through(:google_oauth2, google, uid: "s-21", name: "Sam Example", email: "sam@example.com")
    sign_in_through(:github, github, uid: "s-21-gh", name: "Sam Example", email: "sam@example.com")

    expect(User.where(email: "sam@example.com").pluck(:provider)).to contain_exactly("google_oauth2", "github")
    send_json(google, :post, "/api/collections", { name: "Work" })
    expect(google.response).to have_http_status(:created)

    lists = %w[collections tags notes].map do |list|
      github.get "/api/#{list}"
      JSON.parse(github.response.body)
    end
    expect(lists).to eq([ { "collections" => [] }, { "tags" => [] }, { "notes" => [] } ])

    send_json(github, :post, "/api/collections", { name: "Work" })
    expect(github.response).to have_http_status(:created)
    google_user = User.find_by!(provider: "google_oauth2", provider_user_id: "s-21")
    expect(google_user.collections.pluck(:name)).to eq([ "Work" ])
  end

  it "AC-21 a logout ends only this browser's sign-in and closes only its connections, never another user's" do
    my_sign_in = me.sign_ins.sole
    their_sign_in = other.sign_ins.sole
    theirs = workspace_of(other)

    expect {
      log_out(my_browser)
    }.to have_broadcasted_to(internal_channel_of(my_sign_in)).with(type: "disconnect", reconnect: false)
      .and have_broadcasted_to(internal_channel_of(their_sign_in)).exactly(0)

    expect(my_browser.response).to have_http_status(:no_content)
    their_browser.get "/api/session"
    expect(answer_of(their_browser.response)).to eq([ 200, { "user" => { "id" => other.id, "display_name" => "Grace Hopper" } } ])
    expect(workspace_of(other)).to eq(theirs)
  end

  it "AC-21 a change sends a batch only on the changing user's stream, holding only their notes" do
    work = collection_named(me, "Work")
    rails_tips = note_titled(me, "Rails tips")
    # Each change of a batch's notes (features/20_realtime_notifications question 5), as the app
    # sends it: a note create, edit, archive, review, and delete, and a collection rename.
    changes = [
      [ :post, "/api/notes", { title: "New tip", body: "B", collection_id: work.id, review_interval: "weekly", next_review_date: today.iso8601 } ],
      [ :patch, "/api/notes/#{rails_tips.id}", { title: "Rails tricks" } ],
      [ :patch, "/api/notes/#{note_titled(me, 'Later').id}", { status: "archived" } ],
      [ :post, "/api/notes/#{rails_tips.id}/review", nil ],
      [ :delete, "/api/notes/#{note_titled(me, 'Plan B').id}", nil ],
      [ :patch, "/api/collections/#{collection_named(me, 'Books').id}", { name: "Library" } ]
    ]
    # One batch on my stream, and it is my batch right after the change: only my notes, "Old idea"
    # at least, so it is never empty.
    one_batch_of_my_notes = lambda do
      have_broadcasted_to(me).from_channel(ReviewRemindersChannel).exactly(:once).with do |batch|
        expect(batch).to eq(ReviewReminderBatch.for(me).deep_stringify_keys)
        expect(Note.where(id: batch["reminders"].pluck("note_id")).distinct.pluck(:user_id)).to eq([ me.id ])
      end
    end

    aggregate_failures do
      changes.each do |verb, path, body|
        expect { send_json(my_browser, verb, path, body) }.to one_batch_of_my_notes.call.and no_batch_to(other)
        expect(my_browser.response).to be_successful, "#{verb.upcase} #{path}: #{my_browser.response.status}"
      end
    end
  end

  it "AC-21 sample data goes only into the workspace of the user it is loaded for" do
    # A third account signs in last, with nothing: the sample data is for it (features/26_local_run
    # question 7). Ada and Grace signed in before it, and both have data.
    newcomer_browser = open_session
    sign_in_through(:github, newcomer_browser, uid: "g-2", name: "Alan Turing")
    newcomer = User.find_by!(provider: "github", provider_user_id: "g-2")
    workspaces = [ workspace_of(me), workspace_of(other) ]

    added = SampleData.load!

    expect(added).to have_attributes(user: newcomer, collections: 3, tags: 4, notes: 10)
    expect([ newcomer.collections.count, newcomer.tags.count, newcomer.notes.count ]).to eq([ 3, 4, 10 ])
    expect([ workspace_of(me), workspace_of(other) ]).to eq(workspaces)
  end
end

# Sample data for a developer's workspace (features/26_local_run, spec questions 5 to
# 12). `bin/rails sample_data:load` (lib/tasks/sample_data.rake) adds it.
class SampleData
  # A refusal: nothing was added, and the message says why.
  class Refused < StandardError; end

  # "Travel" has no notes.
  COLLECTIONS = [ "Programming", "Reading", "Travel" ].freeze

  # "someday" is on no note.
  TAGS = [ "habits", "rails", "someday", "testing" ].freeze

  # The notes, in the order the list shows them (newest first), so they are created from
  # the last to the first. Together they have zero, one, and several tags, two are
  # archived, six have a source URL, and they use every review interval (question 10).
  # next_review and last_reviewed are numbers of days from the user's today when the
  # data is added (T), or nil for no date. On day T, the active notes are overdue (T-3),
  # due today (T), due in the next 7 days (T+2, T+5), due later (T+12, T+20), and with no
  # review scheduled. Where a note has both dates, they are one interval apart.
  NOTES = [
    {
      title: "Active Record callbacks", collection: "Programming", tags: [ "rails" ], status: "active",
      review_interval: "weekly", review_interval_days: nil,
      next_review: -3, last_reviewed: -10,
      source_url: "https://guides.rubyonrails.org/active_record_callbacks.html",
      body: "Callbacks run code at set points in a record's life, such as before validation or after a save. " \
            "Keep them small, and move work that reaches other systems out of them."
    },
    {
      title: "RSpec: let and let!", collection: "Programming", tags: [ "rails", "testing" ], status: "active",
      review_interval: "daily", review_interval_days: nil,
      next_review: 0, last_reviewed: -1,
      source_url: "https://rspec.info/features/3-13/rspec-core/helper-methods/let/",
      body: "let defines a memoized helper that runs the first time an example calls it. " \
            "let! runs before each example, which suits records that must exist before the example starts."
    },
    {
      title: "Weekly review checklist", collection: "Reading", tags: [ "habits" ], status: "active",
      review_interval: "weekly", review_interval_days: nil,
      next_review: 0, last_reviewed: -7,
      source_url: nil,
      body: "Clear the inbox, look over the calendar for the next two weeks, and go through the open projects. " \
            "Then pick the three things that matter most for the coming week."
    },
    {
      title: "Spaced repetition", collection: "Reading", tags: [ "habits" ], status: "active",
      review_interval: "custom", review_interval_days: 3,
      next_review: 2, last_reviewed: -1,
      source_url: "https://en.wikipedia.org/wiki/Spaced_repetition",
      body: "Reviewing material at growing intervals moves it into long-term memory with less total study time. " \
            "Each successful review pushes the next one further out."
    },
    {
      title: "The testing pyramid", collection: "Programming", tags: [ "testing" ], status: "active",
      review_interval: "weekly", review_interval_days: nil,
      next_review: 5, last_reviewed: -2,
      source_url: "https://martinfowler.com/articles/practical-test-pyramid.html",
      body: "Many fast unit tests at the base, fewer integration tests in the middle, and a few end-to-end tests at the top. " \
            "Each check belongs at the lowest level that can catch its bug."
    },
    {
      title: "Deep Work: notes on focus", collection: "Reading", tags: [], status: "active",
      review_interval: "monthly", review_interval_days: nil,
      next_review: 20, last_reviewed: nil,
      source_url: nil,
      body: "Long blocks of undistracted time produce the work that is hard to copy. " \
            "Put them on the calendar, and batch shallow tasks such as email into set times."
    },
    {
      title: "SQLite in production", collection: "Programming", tags: [ "rails", "testing" ], status: "active",
      review_interval: "custom", review_interval_days: 14,
      next_review: 12, last_reviewed: -2,
      source_url: "https://www.sqlite.org/whentouse.html",
      body: "SQLite serves many sites well when the writes come from one machine. " \
            "Turn on write-ahead logging, and keep backups of the database file."
    },
    {
      title: "Side project ideas", collection: "Programming", tags: [], status: "active",
      review_interval: "none", review_interval_days: nil,
      next_review: nil, last_reviewed: nil,
      source_url: nil,
      body: "A command-line tool that turns notes into flashcards. " \
            "A small app that reminds me to water the plants on the balcony."
    },
    {
      title: "Hotwire notes", collection: "Programming", tags: [ "rails" ], status: "archived",
      review_interval: "weekly", review_interval_days: nil,
      next_review: -14, last_reviewed: -21,
      source_url: "https://hotwired.dev/",
      body: "Turbo sends HTML over the wire instead of JSON, and Stimulus adds small pieces of behavior to that HTML. " \
            "This project uses React instead, so these notes are archived."
    },
    {
      title: "Books to read next", collection: "Reading", tags: [], status: "archived",
      review_interval: "none", review_interval_days: nil,
      next_review: nil, last_reviewed: nil,
      source_url: nil,
      body: "The Pragmatic Programmer, Designing Data-Intensive Applications, and A Philosophy of Software Design. " \
            "Archived when the reading list moved to a notebook."
    }
  ].freeze

  # The providers' names in the messages.
  PROVIDERS = { "google_oauth2" => "Google", "github" => "GitHub" }.freeze

  # What a load added: whose workspace, and the numbers of collections, tags, and notes.
  Added = Data.define(:user, :collections, :tags, :notes)

  # Adds the sample data to the workspace of the user whose sign-in is the newest one
  # that logout has not ended (spec question 7), and returns an Added. Raises Refused,
  # and adds nothing, outside the development and test environments (spec question 11),
  # when no one is signed in (question 7), or when that workspace has data (questions 8
  # and 9).
  def self.load!
    raise Refused, "Sample data is for the development and test environments only." unless Rails.env.local?

    newest_sign_in = SignIn.order(created_at: :desc, id: :desc).first
    raise Refused, "No one is signed in. Sign in with Google or GitHub, then run this again." unless newest_sign_in

    new(newest_sign_in.user).add
  end

  # "Ada Lovelace (Google)": whose workspace a message is about.
  def self.owner(user)
    "#{user.display_name} (#{PROVIDERS.fetch(user.provider)})"
  end

  def initialize(user)
    @user = user
  end

  # The check and the records go in one transaction: if any part fails, nothing is added
  # (spec question 10).
  def add
    ActiveRecord::Base.transaction do
      if workspace_has_data?
        raise Refused, "#{self.class.owner(@user)} already has collections, tags, or notes, so no sample data was added. " \
                       "To start over, see \"Sample data\" in the README."
      end

      add_records
    end
  end

  private

    # A collection, a tag, or a note. The saved time zone and the sign-ins do not count
    # (spec question 9).
    def workspace_has_data?
      @user.collections.exists? || @user.tags.exists? || @user.notes.exists?
    end

    def add_records
      # The date in the user's saved time zone, or in UTC without one
      # (features/12_review_interval_setting question 1), read once.
      today = @user.today
      collections = COLLECTIONS.to_h { |name| [ name, @user.collections.create!(name: name) ] }
      tags = TAGS.to_h { |name| [ name, @user.tags.create!(name: name) ] }
      notes = NOTES.reverse_each.map do |note|
        @user.notes.create!(
          collection: collections.fetch(note[:collection]),
          tags: note[:tags].map { |name| tags.fetch(name) },
          next_review_date: note[:next_review] && today + note[:next_review],
          last_reviewed_date: note[:last_reviewed] && today + note[:last_reviewed],
          **note.slice(:title, :body, :source_url, :status, :review_interval, :review_interval_days)
        )
      end
      Added.new(user: @user, collections: collections.size, tags: tags.size, notes: notes.size)
    end
end

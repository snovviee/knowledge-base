require "rails_helper"

# features/26_local_run. `bin/rails sample_data:load` adds the sample data to the
# workspace of the newest sign-in's user, and says whose workspace got it (spec questions
# 6 and 12). The task runs in the test process (spec/support/rake_helpers.rb).
RSpec.describe "sample_data:load", type: :task do
  # A user with a sign-in that logout has not ended, as the sign-in callback leaves it.
  def signed_in(name, provider: "google_oauth2", uid: name.parameterize)
    user = User.create!(provider: provider, provider_user_id: uid, display_name: name)
    user.sign_ins.create!
    user
  end

  # A user's numbers of collections, tags, and notes.
  def workspace(user)
    [ user.collections.count, user.tags.count, user.notes.count ]
  end

  # The number of each kind of record, to show that nothing was added.
  def record_counts
    [ User.count, Collection.count, Tag.count, Note.count, NoteTag.count ]
  end

  # Expects the task to print the message to standard error and nothing to standard
  # output, to end with status 1, and to add nothing (spec question 9).
  def expect_task_refusal(message)
    before = record_counts

    out, err, status = run_task("sample_data:load")

    expect(err).to eq("#{message}\n")
    expect(out).to eq("")
    expect(status).to eq(1)
    expect(record_counts).to eq(before)
  end

  it "AC-26 sample_data:load prints what it added and whose workspace got it" do
    ada = signed_in("Ada Lovelace")

    out, err, status = run_task("sample_data:load")

    expect(out).to eq("Added sample data for Ada Lovelace (Google): 3 collections, 4 tags, 10 notes.\n")
    expect(err).to eq("")
    expect(status).to eq(0)
    expect(workspace(ada)).to eq([ 3, 4, 10 ])
  end

  it "AC-26 sample_data:load prints each refusal as an error and exits with status 1" do
    expect_task_refusal("No one is signed in. Sign in with Google or GitHub, then run this again.")

    ada = signed_in("Ada Lovelace")
    ada.collections.create!(name: "Inbox")
    expect_task_refusal("Ada Lovelace (Google) already has collections, tags, or notes, so no sample data was added. " \
                        "To start over, see \"Sample data\" in the README.")

    # The newest sign-in's user has an empty workspace, and the environment refuses it.
    User.create!(provider: "github", provider_user_id: "g-1", display_name: "Grace Hopper")
      .sign_ins.create!(created_at: 1.minute.from_now)
    allow(Rails).to receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new("production"))
    expect_task_refusal("Sample data is for the development and test environments only.")
  end
end

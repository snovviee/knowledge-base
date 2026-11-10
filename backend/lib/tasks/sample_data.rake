# features/26_local_run: `bin/rails sample_data:load`, run in the running backend with
# `docker compose exec backend bin/rails sample_data:load` (spec question 6). It prints
# what it added and ends with status 0 (question 12). A refusal prints its message to
# standard error and ends with status 1 (question 9). Any other error ends the task with
# Rails' own error output, and the transaction leaves nothing behind (question 10).
namespace :sample_data do
  desc "Add sample data to the workspace of the newest signed-in user (development and test only)"
  task load: :environment do
    added = SampleData.load!
    puts "Added sample data for #{SampleData.owner(added.user)}: " \
         "#{added.collections} collections, #{added.tags} tags, #{added.notes} notes."
  rescue SampleData::Refused => e
    abort e.message
  end
end

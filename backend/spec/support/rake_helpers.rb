require "rake"
require "stringio"

# Helpers for tests of the app's Rake tasks (features/26_local_run; feature 29's task
# specs use them too). A task runs in the test process, inside the example's transaction,
# so the database is as the example left it. Spec files that use them have `type: :task`.
module RakeHelpers
  # Loads the app's tasks (lib/tasks/*.rake and Rails' own) once per process. A second
  # load would give every task its actions twice, so a task would run twice.
  def self.load_app_tasks
    Rails.application.load_tasks if Rake::Task.tasks.empty?
  end

  # Runs a task, even one that already ran in this process (`invoke` after `reenable`).
  # Returns its standard output, its standard error, and its exit status: 0 when it ends
  # normally, else the status of the SystemExit it raised (`abort` raises one with 1).
  def run_task(name, *args)
    RakeHelpers.load_app_tasks
    task = Rake::Task[name]
    task.reenable
    status = 0
    out, err = capture_streams do
      task.invoke(*args)
    rescue SystemExit => e
      status = e.status
    end
    [ out, err, status ]
  end

  # Runs the block with $stdout and $stderr captured, and returns what each got.
  def capture_streams
    out = StringIO.new
    err = StringIO.new
    original = [ $stdout, $stderr ]
    $stdout = out
    $stderr = err
    yield
    [ out.string, err.string ]
  ensure
    $stdout, $stderr = original
  end
end

RSpec.configure do |config|
  config.include RakeHelpers, type: :task
end

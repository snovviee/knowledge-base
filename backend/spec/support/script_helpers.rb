require "fileutils"
require "open3"

# Helpers for tests of the repository's scripts (features/26_local_run), such as
# backend/bin/dev. A script runs in the backend container, where the repository is at
# /app, and a test puts fake commands in a temporary folder in place of the real ones.
# Spec files that use them have `type: :script`.
module ScriptHelpers
  # The repository's root: /app in the backend container.
  def repo_root
    Rails.root.parent
  end

  # Writes an executable file, such as a fake command, and returns its path.
  def write_executable(path, content)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
    File.chmod(0o755, path)
    path
  end

  # Runs a command in a new process. Returns its standard output, its standard error,
  # and its Process::Status. env is added to this process's environment; a nil value
  # removes that variable.
  def run_command(*command, env: {}, chdir: Dir.pwd)
    Open3.capture3(env, *command.map(&:to_s), chdir: chdir.to_s)
  end
end

RSpec.configure do |config|
  config.include ScriptHelpers, type: :script
end

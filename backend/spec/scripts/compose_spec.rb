require "rails_helper"
require "yaml"

# features/26_local_run. `docker compose up` starts the backend through bin/dev, which
# prepares the development database first. Every other backend command,
# `docker compose run --rm backend <command>`, replaces that command and runs alone: the
# entrypoint only installs the gems (spec question 2).
RSpec.describe "The backend service", type: :script do
  # The command that starts the server, in compose.yaml and in the image.
  def server_command
    [ "bin/dev", "--binding=0.0.0.0", "--port=3000", "--pid=/tmp/rails-server.pid" ]
  end

  it "AC-26 docker compose starts the backend through bin/dev, and other backend commands run without it" do
    compose = YAML.safe_load_file(repo_root.join("compose.yaml"))
    expect(compose.dig("services", "backend", "command")).to eq(server_command)

    # The backend stage of the Dockerfile: from its FROM line to the next stage's.
    dockerfile = repo_root.join("Dockerfile").read
    backend_stage = dockerfile[/^FROM \S+ AS backend$.*?(?=^FROM )/m]
    expect(JSON.parse(backend_stage[/^CMD (.+)$/, 1])).to eq(server_command)

    entrypoint = repo_root.join("docker/backend-entrypoint.sh").read
    expect(entrypoint).not_to include("db:prepare")
    expect(entrypoint.lines.map(&:strip).reject(&:empty?).last).to eq('exec "$@"')
  end
end

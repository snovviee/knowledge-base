require "rails_helper"

# features/26_local_run. bin/dev starts the server in compose's backend service. It
# prepares the development database first, so a fresh clone, or a pull that brought new
# migrations, needs no setup command (spec question 2). The tests run a copy of bin/dev
# in a temporary folder, next to a fake bin/rails that logs each call instead of running
# Rails.
RSpec.describe "bin/dev", type: :script do
  around do |example|
    Dir.mktmpdir("bin-dev") do |dir|
      @dir = Pathname(dir)
      example.run
    end
  end

  # A copy of backend/bin/dev in the temporary folder's bin/, next to a fake bin/rails.
  # The fake logs one line per call: its arguments, then "|" and SKIP_TEST_DATABASE as it
  # got it. Its db:prepare ends with prepare_status.
  def install_bin_dev(prepare_status: 0)
    write_executable(@dir.join("bin/dev"), Rails.root.join("bin/dev").read)
    write_executable(@dir.join("bin/rails"), <<~SH)
      #!/bin/sh
      printf '%s|%s\\n' "$*" "${SKIP_TEST_DATABASE-unset}" >> "#{@dir.join("rails.log")}"
      if [ "$1" = "db:prepare" ]; then exit #{prepare_status}; fi
      exit 0
    SH
  end

  # The fake's calls, in order: [arguments, SKIP_TEST_DATABASE].
  def rails_calls
    log = @dir.join("rails.log")
    log.exist? ? log.readlines(chomp: true).map { |line| line.split("|", 2) } : []
  end

  # bin/dev as compose's backend service runs it, with no SKIP_TEST_DATABASE of its own.
  def run_bin_dev
    run_command("bin/dev", "--binding=0.0.0.0", "--port=3000", "--pid=/tmp/x.pid",
      env: { "SKIP_TEST_DATABASE" => nil }, chdir: @dir)
  end

  it "AC-26 bin/dev prepares the development database before it starts the server" do
    install_bin_dev

    _out, err, status = run_bin_dev

    expect(status).to be_success, err
    expect(rails_calls.map(&:first)).to eq([
      "db:prepare",
      "server --binding=0.0.0.0 --port=3000 --pid=/tmp/x.pid"
    ])
    # Only the development database: without the variable, db:prepare in development
    # also prepares the test database, which a test run may be using.
    expect(rails_calls.first.last).to eq("1")
  end

  it "AC-26 bin/dev starts no server when preparing the database fails" do
    install_bin_dev(prepare_status: 1)

    _out, _err, status = run_bin_dev

    expect(status).not_to be_success
    expect(rails_calls.map(&:first)).to eq([ "db:prepare" ])
  end
end

require "rails_helper"

# features/27_local_tests. bin/test, at the root of the repository, runs every check in
# Docker, one after another, and then prints a summary. The tests run the real script,
# /app/bin/test in the backend container, whose /bin/sh is dash, a strict POSIX shell. A
# fake docker comes first on PATH: it logs the arguments of each call, prints one line for
# each `compose run` in place of the check's own output, and ends with the status the
# example gives. So no real check runs inside the suite.
RSpec.describe "bin/test", type: :script do
  around do |example|
    Dir.mktmpdir("bin-test") do |dir|
      @dir = Pathname(dir)
      example.run
    end
  end

  # The fake docker, in the temporary folder's bin/, with a new log. `docker info` ends with
  # info_status. A `compose run` whose arguments contain a key of failing ends with that
  # key's status; any other ends with 0.
  def install_fake_docker(info_status: 0, failing: {})
    FileUtils.rm_f(docker_log)
    statuses = failing.map { |arguments, status| "*\"#{arguments}\"*) exit #{status} ;;" }
    write_executable(@dir.join("bin/docker"), <<~SH)
      #!/bin/sh
      printf '%s\\n' "$*" >> "#{docker_log}"
      if [ "$1" = "info" ]; then exit #{info_status}; fi
      echo "Output of docker $*"
      case "$*" in
      #{statuses.join("\n")}
      esac
      exit 0
    SH
  end

  def docker_log
    @dir.join("docker.log")
  end

  # The fake's calls, in order, each as its arguments.
  def docker_calls
    docker_log.exist? ? docker_log.readlines(chomp: true) : []
  end

  # Runs bin/test from the root of the repository, with the fake docker first on PATH.
  def run_bin_test(*arguments, path: "#{@dir.join("bin")}:#{ENV.fetch("PATH")}")
    run_command(repo_root.join("bin/test"), *arguments, env: { "PATH" => path }, chdir: repo_root)
  end

  # The five checks of plain bin/test, in order, as docker gets them.
  def five_checks
    [
      "compose run --rm -e TZ=UTC backend bundle exec rspec",
      "compose run --rm -e TZ=UTC frontend npx vitest run",
      "compose run --rm frontend npx tsc -b",
      "compose run --rm backend bundle exec rubocop",
      "compose run --rm frontend npx eslint ."
    ]
  end

  it "AC-27 bin/test runs the five checks in Docker and ends with All 5 checks passed" do
    install_fake_docker

    out, err, status = run_bin_test

    # Nothing else: no Brakeman, no bundler-audit, and no up, exec, stop, or down, so the
    # app's own containers are left as they are.
    expect(docker_calls).to eq([ "info", *five_checks ])
    expect(out).to eq(<<~OUT)
      Output of docker compose run --rm -e TZ=UTC backend bundle exec rspec
      Output of docker compose run --rm -e TZ=UTC frontend npx vitest run
      Output of docker compose run --rm frontend npx tsc -b
      Output of docker compose run --rm backend bundle exec rubocop
      Output of docker compose run --rm frontend npx eslint .

      RSpec: passed
      Vitest: passed
      TypeScript: passed
      RuboCop: passed
      ESLint: passed
      All 5 checks passed.
    OUT
    expect(err).to be_empty
    expect(status.exitstatus).to eq(0)
  end

  it "AC-27 bin/test runs every check after one fails, and counts the failed ones" do
    install_fake_docker(failing: { "frontend npx eslint ." => 1 })

    out, _err, status = run_bin_test

    expect(docker_calls).to eq([ "info", *five_checks ])
    expect(out.lines(chomp: true).last(7)).to eq([
      "",
      "RSpec: passed",
      "Vitest: passed",
      "TypeScript: passed",
      "RuboCop: passed",
      "ESLint: failed",
      "1 of 5 checks failed."
    ])
    expect(status.exitstatus).to eq(1)

    install_fake_docker(failing: { "backend bundle exec rspec" => 1, "frontend npx eslint ." => 1 })

    out, _err, status = run_bin_test

    expect(docker_calls).to eq([ "info", *five_checks ])
    expect(out.lines(chomp: true).last(6)).to eq([
      "RSpec: failed",
      "Vitest: passed",
      "TypeScript: passed",
      "RuboCop: passed",
      "ESLint: failed",
      "2 of 5 checks failed."
    ])
    expect(status.exitstatus).to eq(1)
  end

  it "AC-27 bin/test counts a check that cannot start as failed" do
    # 125: Docker's status when it cannot create a check's container.
    install_fake_docker(failing: { "frontend" => 125 })

    out, _err, status = run_bin_test

    expect(docker_calls).to eq([ "info", *five_checks ])
    expect(out.lines(chomp: true).last(6)).to eq([
      "RSpec: passed",
      "Vitest: failed",
      "TypeScript: failed",
      "RuboCop: passed",
      "ESLint: failed",
      "3 of 5 checks failed."
    ])
    expect(status.exitstatus).to eq(1)
  end

  it "AC-27 bin/test stops with status 2 when Docker cannot be reached" do
    message = "Docker is not running or not installed. Start Docker, then run bin/test again.\n"
    install_fake_docker(info_status: 1)

    out, err, status = run_bin_test

    expect([ out, err, status.exitstatus ]).to eq([ "", message, 2 ])
    expect(docker_calls).to eq([ "info" ])

    # No docker command at all: PATH holds only an empty folder.
    out, err, status = run_bin_test(path: @dir.join("empty").tap(&:mkpath).to_s)

    expect([ out, err, status.exitstatus ]).to eq([ "", message, 2 ])
  end

  it "AC-27 bin/test with an option it does not know prints how to use it and runs no check" do
    install_fake_docker

    [ [ "--fast" ], [ "-h" ], [ "--time-zones", "extra" ] ].each do |arguments|
      out, err, status = run_bin_test(*arguments)

      expect(err).to start_with("Usage: bin/test [--time-zones]\n"), "bin/test #{arguments.join(" ")}: #{err.inspect}"
      expect(out).to be_empty
      expect(status.exitstatus).to eq(2)
    end
    expect(docker_calls).to be_empty
  end

  it "AC-27 bin/test --time-zones runs RSpec and Vitest in UTC, Pacific/Kiritimati, and Pacific/Pago_Pago" do
    install_fake_docker

    out, err, status = run_bin_test("--time-zones")

    # Zone by zone, RSpec before Vitest, and neither the type check nor the linters.
    expect(docker_calls).to eq([
      "info",
      "compose run --rm -e TZ=UTC backend bundle exec rspec",
      "compose run --rm -e TZ=UTC frontend npx vitest run",
      "compose run --rm -e TZ=Pacific/Kiritimati backend bundle exec rspec",
      "compose run --rm -e TZ=Pacific/Kiritimati frontend npx vitest run",
      "compose run --rm -e TZ=Pacific/Pago_Pago backend bundle exec rspec",
      "compose run --rm -e TZ=Pacific/Pago_Pago frontend npx vitest run"
    ])
    expect(out.lines(chomp: true).last(8)).to eq([
      "",
      "RSpec (UTC): passed",
      "Vitest (UTC): passed",
      "RSpec (Pacific/Kiritimati): passed",
      "Vitest (Pacific/Kiritimati): passed",
      "RSpec (Pacific/Pago_Pago): passed",
      "Vitest (Pacific/Pago_Pago): passed",
      "All 6 checks passed."
    ])
    expect(err).to be_empty
    expect(status.exitstatus).to eq(0)

    install_fake_docker(failing: { "TZ=Pacific/Pago_Pago frontend" => 1 })

    out, _err, status = run_bin_test("--time-zones")

    expect(out.lines(chomp: true).last(7)).to eq([
      "RSpec (UTC): passed",
      "Vitest (UTC): passed",
      "RSpec (Pacific/Kiritimati): passed",
      "Vitest (Pacific/Kiritimati): passed",
      "RSpec (Pacific/Pago_Pago): passed",
      "Vitest (Pacific/Pago_Pago): failed",
      "1 of 6 checks failed."
    ])
    expect(status.exitstatus).to eq(1)
  end
end

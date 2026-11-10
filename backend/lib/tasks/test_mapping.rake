# features/29_test_mapping: `bin/rails test_mapping:write` writes specs/docs/test_mapping.md from the
# names of the tests and from the plans, and `bin/rails test_mapping:check` checks that it is
# current (spec question 1). Both read files only, and neither runs a test. The check changes no
# file. It prints its problems to standard error and ends with status 1.
namespace :test_mapping do
  desc "Write specs/docs/test_mapping.md from the test names and the plans"
  task write: :environment do
    document = TestMapping.write
    puts "Wrote #{TestMapping::PATH}: #{document.backend_total} backend tests, " \
         "#{document.frontend_total} frontend tests."
  end

  desc "Check that specs/docs/test_mapping.md is current"
  task check: :environment do
    problems = TestMapping.check
    abort [ "Test mapping check failed:", *problems ].join("\n") if problems.any?

    puts "Test mapping check passed: #{TestMapping::PATH} is current."
  end
end

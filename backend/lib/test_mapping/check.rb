module TestMapping
  # The check of specs/docs/test_mapping.md: the problems that make it fail, one line each. It
  # reads files only, and changes none.
  class Check
    # A test in the Tests column of the README's table: `<file>`: "<full name>".
    README_TEST = /`([^`]+)`:\s*"((?:\\.|[^"\\])*)"/

    def initialize(repository)
      @repository = repository
      @document = Document.new(repository)
    end

    def problems
      file_problems + unknown_test_problems + readme_problems
    end

    private

    def file_problems
      written = @repository.file(PATH)
      return [ "- #{PATH} does not exist. Run bin/rails test_mapping:write." ] unless written

      stale = stale_parts(written)
      return [] if stale.empty?

      [ "- #{PATH} is out of date in: #{stale.join(", ")}. Run bin/rails test_mapping:write." ]
    end

    # The parts of the written mapping that differ from the mapping of the files as they are now.
    # When every part is the same and only their order differs, the parts out of place.
    def stale_parts(written)
      expected = parts(@document.text)
      actual = parts(written)
      names = (expected.keys + actual.keys).uniq
      changed = names.reject { |name| expected[name] == actual[name] }
      return changed unless changed.empty? && written != @document.text

      names.reject { |name| expected.keys.index(name) == actual.keys.index(name) }
    end

    # The text by part: "the summary" is everything before the first "## ", and each section is
    # named by its heading: "AC-NN", or "Tests with no known AC".
    def parts(text)
      text.split(/^(?=## )/).each_with_object({}) do |part, parts|
        name = part.start_with?("## ") ? part.lines.first.delete_prefix("## ").strip : "the summary"
        parts[name] = parts.fetch(name, "") + part
      end
    end

    # A test with no known AC fails the check even when the mapping lists it.
    def unknown_test_problems
      @document.unknown_tests.map do |test|
        name = test.name ? "\"#{test.name}\"" : TestMapping.inline_code(test.first_line)
        "- A test has no known AC: #{test.file}: #{name}."
      end
    end

    # Each test that the README's table names and its file does not have, skipped or not.
    def readme_problems
      readme_tests.filter_map do |file, name|
        next if @repository.tests.any? { |test| test.file == file && test.name == name }

        "- README.md \"Test coverage\" names a test that does not exist: #{file}: \"#{name}\"."
      end
    end

    # The file and the full name of each test in the Tests column, the third, of the table under
    # the heading "Test coverage". A '"' or a '|' in a name is written '\"' or '\|'.
    def readme_tests
      coverage_section.grep(/\A\|/).flat_map do |row|
        tests_cell = row.split(/(?<!\\)\|/)[3].to_s # [0] is the empty text before the first "|".
        tests_cell.scan(README_TEST).map { |file, name| [ file, name.gsub(/\\(["|])/, '\1') ] }
      end
    end

    # The lines below the README's heading "Test coverage", of level 2 or 3, up to the next heading
    # of the same or a higher level. A line in a fenced code block is never a heading.
    def coverage_section
      level = nil
      fenced = false
      @repository.file("README.md").to_s.lines.each_with_object([]) do |line, section|
        fenced = !fenced if line.start_with?("```", "~~~")
        heading_level = line[/\A#+(?= )/]&.size unless fenced
        if level
          break section if heading_level && heading_level <= level

          section << line
        elsif heading_level && line.match?(/\A(?:##|###) Test coverage\s*\z/)
          level = heading_level
        end
      end
    end
  end
end

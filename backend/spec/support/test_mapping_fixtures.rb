# Fixture repositories for the specs of the test mapping (features/29_test_mapping). Each example
# builds a small repository in a temporary folder and points TestMapping.root at it, so no example
# reads the real tests or plans, and none depends on the real mapping being current.
#
# The fixture tests are built by the methods below, never written out as lines of a spec file:
# TestMapping reads every *_spec.rb file, and a line there that looks like a test is one.
RSpec.shared_context "test mapping fixtures" do
  let(:root) { Pathname(Dir.mktmpdir("test_mapping")) }

  before { allow(TestMapping).to receive(:root).and_return(root) }
  after { FileUtils.rm_rf(root) }

  # A file of the fixture repository, from its lines.
  def write_file(path, *lines)
    file = root.join(path)
    file.dirname.mkpath
    file.write(lines.join("\n") + "\n")
  end

  # requirements.md with the given ACs in section 10, after a line in section 9 that looks like an AC.
  def write_requirements(acs)
    write_file(
      "requirements.md",
      '<section id="9" title="Optional deliverable: containerization">',
      "",
      "- AC-99: A line outside section 10 is not an acceptance criterion",
      "",
      "</section>",
      "",
      '<section id="10" title="Acceptance checklist">',
      "",
      *acs.map { |id, text| "- #{id}: #{text}" },
      "",
      "</section>"
    )
  end

  # One test as the first line of an RSpec file declares it.
  def rspec_test(name, keyword: "it", quote: '"', parens: false, tail: " do", indent: 2)
    literal = "#{quote}#{name}#{quote}"
    "#{" " * indent}#{keyword}#{parens ? "(#{literal})" : " #{literal}"}#{tail}"
  end

  # An RSpec file with one group that holds the given tests, each closed by its own "end". A test
  # given as an array of lines takes several lines.
  def write_spec(path, *tests)
    write_file(path, 'RSpec.describe "Fixture" do', *tests.flat_map { |test| [ *test, "  end" ] }, "end")
  end

  # One test as the first line of a Vitest file declares it.
  def vitest_test(name, keyword: "it", quote: "'", tail: ", () => {", indent: 2)
    "#{" " * indent}#{keyword}(#{quote}#{name}#{quote}#{tail}"
  end

  # A Vitest file with one group that holds the given tests, each closed by its own "})". A test
  # given as an array of lines takes several lines.
  def write_vitest(path, *tests)
    write_file(path, "describe('Fixture', () => {", *tests.flat_map { |test| [ *test, "  })" ] }, "})")
  end

  # A plan.md whose Test plan has one item per entry of results, each with those Result lines,
  # and whose Docs has one checkbox per entry of docs, ticked when true. The lines around them
  # look like items, results, and checkboxes, but are not.
  def write_plan(folder, results: [], docs: [])
    write_file(
      "specs/features/#{folder}/plan.md",
      "# Plan: #{folder}",
      "",
      "## Approach",
      "",
      "1. A numbered line outside the Test plan is not an item.",
      "",
      "## Checklist",
      "",
      "- [x] 1. [BE] A checklist item is not a Docs check.",
      "  - Result: Pass, 2026-11-09, and a Result line outside the Test plan is not a result.",
      "",
      "## Test plan",
      "",
      "- **Before the items.** A list item here is not a Test plan item.",
      "",
      *results.each_with_index.flat_map { |item_results, index|
        [
          "#{index + 1}. Scenario #{index + 1}",
          "   - Steps: change the last `Result:` line, which a line of Steps is not.",
          "   - Expected: it works.",
          *item_results.map { |result| "   - Result: #{result}" }
        ]
      },
      "",
      "## Docs",
      "",
      *docs.each_with_index.flat_map { |ticked, index|
        [ "- [#{ticked ? "x" : " "}] #{index + 1}. A document", "  - Check: it holds what it must." ]
      },
      "",
      "## Deviations",
      "",
      "None yet."
    )
  end
end

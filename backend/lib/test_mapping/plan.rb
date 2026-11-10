module TestMapping
  # A feature's plan.md, specs/features/<folder>/plan.md, as the mapping reads it: the items of its
  # Test plan with their last results, and the checks of its Docs.
  class Plan
    attr_reader :folder

    def initialize(folder, text)
      @folder = folder
      @text = text
    end

    # The items of "## Test plan": each a line "N. " at the start of a line.
    def test_plan_items
      last_results.size
    end

    # The items whose last "Result:" line starts with "Pass". An item that failed and then passed
    # counts.
    def test_plan_passed
      last_results.count { |result| result&.start_with?("Pass") }
    end

    # The checks of "## Docs": the lines "- [ ] " and "- [x] " at the start of a line.
    def docs_checks
      docs_checkboxes.size
    end

    def docs_ticked
      docs_checkboxes.count { |line| line.match?(/\A- \[[xX]\] /) }
    end

    private

    def docs_checkboxes
      section("Docs").grep(/\A- \[[ xX]\] /)
    end

    # The last "- Result:" line below each item of the Test plan, up to the next item, or nil.
    def last_results
      @last_results ||= section("Test plan").each_with_object([]) do |line, results|
        if line.match?(/\A\d+\. /)
          results << nil
        elsif !results.empty? && (result = line[/\A\s*- Result:\s*(.*)/, 1])
          results[-1] = result
        end
      end
    end

    # The lines below the heading "## <heading>", up to the next heading of level 2.
    def section(heading)
      @text.split(/^(?=## )/).find { |part| part.lines.first.chomp == "## #{heading}" }.to_s.lines.drop(1)
    end
  end
end

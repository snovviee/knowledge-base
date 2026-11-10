module TestMapping
  # How an RSpec file declares its tests and its groups (TestFile).
  module RspecSyntax
    # A line that starts, after its indentation, with a test keyword and then "(" or a space.
    TEST = /\A\s*(?<keyword>it|specify|example|scenario|fit|fspecify|fexample|fscenario|xit|xspecify|xexample|xscenario|skip|pending)(?=[ (])/
    SKIPPED = %w[xit xspecify xexample xscenario skip pending].freeze
    # skip and pending declare a test only when they open a block. Without one, they are statements
    # inside a test.
    BLOCK_ONLY = %w[skip pending].freeze
    # A group of tests. It is not a test, even when its name holds an AC ID.
    GROUP = /\A\s*(?:RSpec\.)?(?<keyword>[fx]?(?:describe|context))(?=[ (])/
    SKIPPED_GROUPS = %w[xdescribe xcontext].freeze
    SKIP_METADATA = /\bskip:|:skip\b|\bpending:|:pending\b/
    # A string literal: its quote, then any escaped character or any character but that quote.
    LITERAL = /\A(["'])((?:\\.|(?!\1).)*)\1/
    INTERPOLATION = { '"' => '#{' }.freeze

    module_function

    # The tail is what follows the name, or the arguments when the name is not a literal.
    def test?(match, tail)
      !BLOCK_ONLY.include?(match[:keyword]) || tail.match?(/\bdo\b|\{/)
    end

    def named?(_match)
      true
    end

    def skipped?(match, tail)
      SKIPPED.include?(match[:keyword]) || skip_metadata?(tail)
    end

    def skipped_group?(match, tail)
      SKIPPED_GROUPS.include?(match[:keyword]) || skip_metadata?(tail)
    end

    # The metadata after the name, before the block.
    def skip_metadata?(tail)
      tail.split(/\bdo\b|\{/, 2).first.to_s.match?(SKIP_METADATA)
    end
  end
end

module TestMapping
  # How a Vitest file declares its tests and its groups (TestFile).
  module VitestSyntax
    # A line that starts, after its indentation, with a test keyword and its modifiers, and then
    # "(" or a space.
    TEST = /\A\s*(?<keyword>it|test)(?<modifiers>(?:\.(?:only|skip|todo|concurrent|sequential|fails|each))*)(?=[ (])/
    # A group of tests. It is not a test, even when its name holds an AC ID.
    GROUP = /\A\s*describe(?<modifiers>(?:\.(?:only|skip|todo|concurrent|sequential|shuffle|each))*)(?=[ (])/
    SKIPPED = /\.(?:skip|todo)\b/
    # The options object that follows the name: { skip: true } or { todo: true }.
    SKIP_OPTIONS = /\A\s*,\s*\{[^}]*\b(?:skip|todo)\s*:\s*true\b/
    # A string literal: its quote, then any escaped character or any character but that quote.
    LITERAL = /\A(["'`])((?:\\.|(?!\1).)*)\1/
    INTERPOLATION = { "`" => "${" }.freeze

    module_function

    def test?(_match, _tail)
      true
    end

    # it.each(…) takes its table first, so its name is not plain text.
    def named?(match)
      !match[:modifiers].include?(".each")
    end

    # The tail is what follows the name, or the arguments when the name is not a literal.
    def skipped?(match, tail)
      match[:modifiers].match?(SKIPPED) || tail.match?(SKIP_OPTIONS)
    end

    def skipped_group?(match, tail)
      skipped?(match, tail)
    end
  end
end

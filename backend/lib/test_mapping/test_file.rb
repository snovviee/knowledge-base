module TestMapping
  # The tests that one test file declares, read from its source line by line, with the syntax of
  # its test framework: RspecSyntax for a Ruby file, VitestSyntax for any other.
  class TestFile
    # What may follow a name that is one literal: the next argument, the closing parenthesis, the
    # block, a comment, or nothing.
    PLAIN_TAIL = /\A\s*(?:[,)]|do\b|\{|#|\z)/

    def initialize(file, source)
      @file = file
      @source = source
    end

    # Every test inside a skipped group is skipped. A group's extent is the lines indented deeper
    # than its opening line, up to the next line at its indentation or less.
    def tests
      lines = @source.lines
      skipped_groups = [] # The indentation of each skipped group that is open.
      lines.each_index.filter_map do |index|
        next if lines[index].strip.empty?

        indentation = lines[index][/\A\s*/].size
        skipped_groups.pop while skipped_groups.any? && indentation <= skipped_groups.last
        if skipped_group?(lines, index)
          skipped_groups.push(indentation)
          next
        end
        test = test_at(lines, index)
        skipped_groups.any? && test ? test.with(skipped: true) : test
      end
    end

    private

    def syntax
      @file.end_with?(".rb") ? RspecSyntax : VitestSyntax
    end

    def skipped_group?(lines, index)
      match = syntax::GROUP.match(lines[index]) or return false
      syntax.skipped_group?(match, name_and_tail(lines, index, match).last)
    end

    # The test that the line at index declares, or nil.
    def test_at(lines, index)
      match = syntax::TEST.match(lines[index]) or return
      literal, tail = name_and_tail(lines, index, match)
      return unless syntax.test?(match, tail)

      name = plain_name(literal) if syntax.named?(match)
      Test.new(file: @file, name: name, ids: ids_in(name), first_line: lines[index].strip,
        skipped: syntax.skipped?(match, tail))
    end

    # The string literal that starts the arguments after the keyword, if any, and the tail: what
    # follows that literal, or the arguments when there is none. The name may begin on the line
    # after "it(", and options or metadata may follow on the line after the name.
    def name_and_tail(lines, index, match)
      arguments = match.post_match.lstrip.delete_prefix("(").lstrip
      if arguments.empty?
        index += 1
        arguments = lines[index].to_s.lstrip
      end
      literal = syntax::LITERAL.match(arguments)
      tail = literal ? literal.post_match : arguments
      tail += lines[index + 1].to_s if tail.strip == ","
      [ literal, tail ]
    end

    # The name when it is plain text: one string literal with no interpolation. An escaped quote
    # or backslash is read as the character.
    def plain_name(literal)
      return unless literal && PLAIN_TAIL.match?(literal.post_match)
      return if interpolated?(literal[1], literal[2])

      literal[2].gsub(/\\(["'`\\])/, '\1')
    end

    # "#{…}" in a Ruby string in double quotes, or "${…}" in a JavaScript template literal.
    def interpolated?(quote, content)
      opening = syntax::INTERPOLATION[quote]
      opening && content.scan(/\\.|#\{|\$\{|./m).include?(opening)
    end

    # The run of AC IDs at the start of a name, each followed by a space: "AC-13 AC-14 marks …".
    def ids_in(name)
      name.to_s[/\A(?:AC-\d{2} )+/].to_s.split
    end
  end
end

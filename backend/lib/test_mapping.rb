# The test mapping of features/29_test_mapping: for each acceptance criterion of requirements.md
# section 10, its automated tests and its manual validation, as specs/docs/test_mapping.md holds
# them. It reads the test files and the plans, and never runs a test.
module TestMapping
  PATH = "specs/docs/test_mapping.md"

  # The repository. The backend container mounts it at /app, one level above Rails.root.
  def self.root
    Rails.root.parent
  end

  # The mapping of the files as they are now.
  def self.document
    Document.new(Repository.new(root))
  end

  # The mapping as specs/docs/test_mapping.md holds it when it is current.
  def self.text
    document.text
  end

  # Writes specs/docs/test_mapping.md, creating its folder when it is missing, and returns the
  # mapping that it wrote.
  def self.write
    document.tap do |written|
      root.join(PATH).dirname.mkpath
      root.join(PATH).write(written.text)
    end
  end

  # The problems that make the check fail, one line each. It changes no file.
  def self.check
    Check.new(Repository.new(root)).problems
  end

  # The text as Markdown inline code, fenced by more backticks than any run of backticks in it.
  def self.inline_code(text)
    fence = "`" * (text.scan(/`+/).map(&:length).max.to_i + 1)
    fence == "`" ? "`#{text}`" : "#{fence} #{text} #{fence}"
  end
end

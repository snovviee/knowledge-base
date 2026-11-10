require "find"

module TestMapping
  # What the mapping is made from, read from the files of the repository under root.
  class Repository
    AcceptanceCriterion = Data.define(:id, :text)

    # RSpec's default pattern; backend/.rspec sets no other.
    BACKEND_TESTS = "backend/spec/**/*_spec.rb"
    # Vitest's default include and exclude; frontend/vite.config.ts sets neither.
    FRONTEND_TEST = /\.(?:test|spec)\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)\z/
    FRONTEND_EXCLUDED = %w[node_modules .git].freeze

    def initialize(root)
      @root = root
    end

    # The lines "- AC-NN: <text>" of requirements.md section 10, in its order. Their IDs are the
    # known AC IDs.
    def acceptance_criteria
      @acceptance_criteria ||= begin
        section = read("requirements.md")[%r{<section id="10".*?</section>}m].to_s
        section.scan(/^- (AC-\d{2}): (.+)$/).map { |id, text| AcceptanceCriterion.new(id, text) }
      end
    end

    # Every test, in a fixed order: backend files before frontend files, files by path, and tests
    # in the order of their file.
    def tests
      @tests ||= (backend_files + frontend_files).flat_map { |file| TestFile.new(file, read(file)).tests }
    end

    # The plans by AC ID: specs/features/NN_<topic>/plan.md belongs to AC-NN.
    def plans
      @plans ||= Dir.glob("specs/features/*/plan.md", base: @root).sort.to_h do |file|
        folder = File.basename(File.dirname(file))
        [ "AC-#{folder[/\A\d{2}(?=_)/]}", Plan.new(folder, read(file)) ]
      end
    end

    # The text of a file of the repository, or nil when there is none.
    def file(path)
      read(path) if @root.join(path).file?
    end

    private

    def read(file)
      @root.join(file).read(encoding: "UTF-8")
    end

    def backend_files
      Dir.glob(BACKEND_TESTS, base: @root).sort
    end

    def frontend_files
      frontend = @root.join("frontend")
      return [] unless frontend.directory?

      files = []
      Find.find(frontend) do |path|
        Find.prune if FRONTEND_EXCLUDED.include?(File.basename(path))
        files << Pathname(path).relative_path_from(@root).to_s if FRONTEND_TEST.match?(path) && File.file?(path)
      end
      files.sort
    end
  end
end

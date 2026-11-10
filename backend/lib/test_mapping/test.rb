module TestMapping
  # A test as its file declares it: the file's path from the repository root, its name (nil when
  # it is not plain text), the AC IDs its name starts with, its first line, trimmed, and whether
  # it is skipped. A skipped test is listed, and counted nowhere.
  Test = Data.define(:file, :name, :ids, :first_line, :skipped) do
    def backend?
      file.start_with?("backend/")
    end

    def counted?
      !skipped
    end
  end
end

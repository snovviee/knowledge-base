require "rails_helper"

# features/27_local_tests, spec question 3. The backend tests use their own test database,
# never the development one, so they pass whether the app runs or not, and never read or
# change the app's data.
RSpec.describe "The backend tests' database" do
  it "AC-27 the backend tests run against the test database, never the development one" do
    expect(Rails.env).to eq("test")

    config = ActiveRecord::Base.connection_db_config
    expect(config.env_name).to eq("test")

    development = ActiveRecord::Base.configurations.configs_for(env_name: "development", name: "primary")
    expect(File.expand_path(config.database, Rails.root))
      .not_to eq(File.expand_path(development.database, Rails.root))
  end
end

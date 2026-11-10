require "rails_helper"

# features/06_collections_crud. The API sends each validation code as is
# ({ "fields": { "name": "<code>" } }), so these examples check the codes.
RSpec.describe Collection, type: :model do
  let(:user) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }

  it "AC-06 a collection belongs to a user, and its name is tidied and required" do
    collection = user.collections.create!(name: "  Book \t\n  notes  ")

    expect(collection.reload.name).to eq("Book notes")
    expect(collection.user).to eq(user)
    expect(Collection.new(name: "Work")).not_to be_valid

    [ nil, "", "   ", "\t\n" ].each do |blank|
      collection = user.collections.new(name: blank)
      expect(collection).not_to be_valid
      expect(collection.errors.details[:name]).to include(error: :blank)
    end
  end

  it "AC-06 a collection name has at most 100 characters" do
    # Spaces that tidying removes do not count.
    expect(user.collections.new(name: "  #{'a' * 100}  ")).to be_valid
    expect(user.collections.new(name: "é" * 100)).to be_valid

    collection = user.collections.new(name: "a" * 101)
    expect(collection).not_to be_valid
    expect(collection.errors.details[:name]).to include(a_hash_including(error: :too_long))
  end

  it "AC-06 a collection name is unique per user, ignoring case in any alphabet" do
    work = user.collections.create!(name: "Work")
    user.collections.create!(name: "Работа")

    [ "Work", "work", "  WORK ", "работа", "РАБОТА" ].each do |taken|
      collection = user.collections.new(name: taken)
      expect(collection).not_to be_valid
      expect(collection.errors.details[:name]).to include(error: :taken)
    end

    other_user = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    expect(other_user.collections.new(name: "Work")).to be_valid

    # A collection may keep its own name, or change only its case.
    work.name = "Work"
    expect(work).to be_valid
    work.name = "WORK"
    expect(work).to be_valid
  end
end

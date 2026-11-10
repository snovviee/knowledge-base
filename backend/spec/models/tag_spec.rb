require "rails_helper"

# features/08_tags_crud. Tags have the name rules of collections (feature 06), and
# the API sends each validation code as is ({ "fields": { "name": "<code>" } }), so
# these examples check the codes.
RSpec.describe Tag, type: :model do
  let(:user) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }

  it "AC-08 a tag belongs to a user, and its name is tidied and required" do
    tag = user.tags.create!(name: "  machine \t\n  learning  ")

    expect(tag.reload.name).to eq("machine learning")
    expect(tag.user).to eq(user)
    expect(Tag.new(name: "work")).not_to be_valid

    [ nil, "", "   ", "\t\n" ].each do |blank|
      tag = user.tags.new(name: blank)
      expect(tag).not_to be_valid
      expect(tag.errors.details[:name]).to include(error: :blank)
    end
  end

  it "AC-08 a tag name has at most 100 characters" do
    # Spaces that tidying removes do not count.
    expect(user.tags.new(name: "  #{'t' * 100}  ")).to be_valid
    expect(user.tags.new(name: "é" * 100)).to be_valid

    tag = user.tags.new(name: "t" * 101)
    expect(tag).not_to be_valid
    expect(tag.errors.details[:name]).to include(a_hash_including(error: :too_long))
  end

  it "AC-08 a tag name is unique among the user's tags, ignoring case in any alphabet" do
    work = user.tags.create!(name: "Work")
    user.tags.create!(name: "Работа")

    [ "Work", "work", "  WORK ", "работа", "РАБОТА" ].each do |taken|
      tag = user.tags.new(name: taken)
      expect(tag).not_to be_valid
      expect(tag.errors.details[:name]).to include(error: :taken)
    end

    # Another user's tag, and one of the user's own collections, do not count.
    other_user = User.create!(provider: "github", provider_user_id: "42", display_name: "Grace")
    expect(other_user.tags.new(name: "Work")).to be_valid
    user.collections.create!(name: "Reading")
    expect(user.tags.new(name: "reading")).to be_valid

    # Any characters: "#work" is not "work" (spec question 3).
    expect(user.tags.new(name: "#work")).to be_valid

    # A tag may keep its own name, or change only its case.
    work.name = "Work"
    expect(work).to be_valid
    work.name = "WORK"
    expect(work).to be_valid
  end
end

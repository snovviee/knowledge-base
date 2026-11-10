require "rails_helper"

# features/10_note_tags. A note has zero or more of its user's tags, each linked once.
# Deleting a tag removes its links and no note (spec: "Deleting a tag keeps its notes";
# requirements.md 3.3). Deleting a note removes its links and no tag.
RSpec.describe "Note tags", type: :model do
  let(:user) { User.create!(provider: "google_oauth2", provider_user_id: "u-1", display_name: "Ada") }
  let(:work) { user.collections.create!(name: "Work") }

  def note_in_work(title = "Rails tips")
    user.notes.create!(collection: work, title: title, body: "Body")
  end

  it "AC-10 a note has zero or more tags, each linked once" do
    ruby = user.tags.create!(name: "ruby")
    web = user.tags.create!(name: "web")
    note = note_in_work
    expect(note.tags).to be_empty

    note.add_tag(web)
    note.add_tag(ruby)
    note.add_tag(ruby)

    expect(note.reload.tags.map(&:name)).to contain_exactly("ruby", "web")
    expect(NoteTag.count).to eq(2)
    expect(ruby.notes).to eq([ note ])
  end

  it "AC-10 deleting a tag removes it from its notes and deletes no note" do
    web = user.tags.create!(name: "web")
    note = note_in_work
    note.tags << web

    expect { web.destroy! }.not_to change(Note, :count)

    expect(note.reload.tags).to be_empty
    expect(Note.exists?(note.id)).to be true
  end

  it "AC-10 deleting a note removes its links and keeps its tags" do
    ruby = user.tags.create!(name: "ruby")
    gone = note_in_work("Gone")
    kept = note_in_work("Kept")
    gone.tags << ruby
    kept.tags << ruby

    expect { gone.destroy! }.not_to change(Tag, :count)

    expect(ruby.reload.notes).to eq([ kept ])
    expect(NoteTag.count).to eq(1)
  end
end

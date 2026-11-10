# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_09_231200) do
  create_table "collections", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "name", null: false
    t.string "folded_name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "folded_name"], name: "index_collections_on_user_id_and_folded_name", unique: true
  end

  create_table "note_tags", id: false, force: :cascade do |t|
    t.integer "note_id", null: false
    t.integer "tag_id", null: false
    t.index ["note_id", "tag_id"], name: "index_note_tags_on_note_id_and_tag_id", unique: true
    t.index ["note_id"], name: "index_note_tags_on_note_id"
    t.index ["tag_id"], name: "index_note_tags_on_tag_id"
  end

  create_table "notes", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "collection_id", null: false
    t.string "title", null: false
    t.text "body", null: false
    t.string "source_url"
    t.string "status", default: "active", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "review_interval", default: "none", null: false
    t.integer "review_interval_days"
    t.date "next_review_date"
    t.date "last_reviewed_date"
    t.string "search_title"
    t.text "search_body"
    t.string "search_source_url"
    t.index ["collection_id"], name: "index_notes_on_collection_id"
    t.index ["user_id", "created_at"], name: "index_notes_on_user_id_and_created_at"
  end

  create_table "review_dismissals", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "note_id", null: false
    t.date "next_review_date", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["note_id", "next_review_date"], name: "index_review_dismissals_on_note_id_and_next_review_date", unique: true
    t.index ["user_id"], name: "index_review_dismissals_on_user_id"
  end

  create_table "sign_ins", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "token", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token"], name: "index_sign_ins_on_token", unique: true
    t.index ["user_id"], name: "index_sign_ins_on_user_id"
  end

  create_table "tags", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "name", null: false
    t.string "folded_name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "folded_name"], name: "index_tags_on_user_id_and_folded_name", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "provider", null: false
    t.string "provider_user_id", null: false
    t.string "email"
    t.string "display_name", null: false
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "time_zone"
    t.index ["provider", "provider_user_id"], name: "index_users_on_provider_and_provider_user_id", unique: true
  end

  add_foreign_key "collections", "users"
  add_foreign_key "note_tags", "notes", on_delete: :cascade
  add_foreign_key "note_tags", "tags", on_delete: :cascade
  add_foreign_key "notes", "collections"
  add_foreign_key "notes", "users"
  add_foreign_key "review_dismissals", "notes", on_delete: :cascade
  add_foreign_key "review_dismissals", "users"
  add_foreign_key "sign_ins", "users"
  add_foreign_key "tags", "users"
end

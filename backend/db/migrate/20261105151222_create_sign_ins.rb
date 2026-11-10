class CreateSignIns < ActiveRecord::Migration[8.1]
  def change
    create_table :sign_ins do |t|
      t.references :user, null: false, foreign_key: true
      t.string :token, null: false

      t.timestamps
    end
    add_index :sign_ins, :token, unique: true
  end
end

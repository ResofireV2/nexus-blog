defmodule Blog.Migrations.V1CreateBlogCategories do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:blog_categories) do
      add :name,  :string, null: false
      add :slug,  :string, null: false
      add :color, :string, null: false, default: "#3b82f6"
      add :icon,  :string, null: false, default: "fa-tag"
      timestamps(type: :utc_datetime)
    end

    create_if_not_exists unique_index(:blog_categories, [:slug])
  end
end

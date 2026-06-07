defmodule Blog.Migrations.V2CreateBlogArticles do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:blog_articles) do
      add :title,                :string,  null: false
      add :slug,                 :string,  null: false
      add :body,                 :text,    null: false, default: ""
      add :status,               :string,  null: false, default: "draft"
      add :hero_image_url,       :string
      add :reading_time_minutes, :integer, null: false, default: 1
      add :category_id,          references(:blog_categories, on_delete: :nilify_all)
      add :author_id,            references(:users, on_delete: :nilify_all)
      add :published_at,         :utc_datetime
      timestamps(type: :utc_datetime)
    end

    create_if_not_exists unique_index(:blog_articles, [:slug])
    create_if_not_exists index(:blog_articles, [:status])
    create_if_not_exists index(:blog_articles, [:author_id])
    create_if_not_exists index(:blog_articles, [:category_id])
    create_if_not_exists index(:blog_articles, [:published_at])
  end
end

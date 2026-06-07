defmodule Blog.Migrations.V3CreateBlogImages do
  use Ecto.Migration

  def change do
    create_if_not_exists table(:blog_images) do
      add :article_id, references(:blog_articles, on_delete: :delete_all), null: false
      add :url,        :string, null: false
      add :inserted_at, :utc_datetime, null: false
    end

    create_if_not_exists index(:blog_images, [:article_id])
  end
end

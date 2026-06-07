defmodule Blog do
  @moduledoc """
  Blog extension for Nexus.

  A full-featured community blog with categories, hero images, rich articles,
  and digest integration.

  ## Tables

  - `blog_categories` — admin-managed categories with color and FA icon
  - `blog_articles`   — articles with status, hero image, body, author
  - `blog_images`     — inline image upload tracking; deleted automatically
                        when the parent article is deleted (on_delete: :delete_all)
  """

  use Nexus.Extensions.Behaviour

  import Ecto.Query
  alias Nexus.Repo

  @impl true
  def migrations do
    [
      Blog.Migrations.V1CreateBlogCategories,
      Blog.Migrations.V2CreateBlogArticles,
      Blog.Migrations.V3CreateBlogImages
    ]
  end

  @impl true
  def routes do
    [{"/", Blog.ApiRouter, []}]
  end

  @impl true
  def on_uninstall do
    Nexus.Extensions.Storage.delete_all("blog")
    :ok
  end

  # Digest section — "recent_articles".
  # Returns the most recently published articles for the digest period.
  @impl true
  def handle_digest_section("recent_articles", period, _settings) do
    items =
      Repo.all(
        from a in "blog_articles",
          left_join: c in "blog_categories", on: c.id == a.category_id,
          where: a.status == "published",
          where: a.published_at >= ^period.from,
          where: a.published_at <= ^period.to,
          order_by: [desc: a.published_at],
          limit: 5,
          select: %{
            title:                a.title,
            slug:                 a.slug,
            reading_time_minutes: a.reading_time_minutes,
            category_name:        c.name
          }
      )
      |> Enum.map(fn a ->
        %{
          label:    a.title,
          sublabel: if(a.category_name, do: a.category_name, else: "Article"),
          value:    "#{a.reading_time_minutes} min read",
          url:      "/ext/blog/article/#{a.slug}"
        }
      end)

    %{
      title:  "Latest from the blog",
      layout: "list",
      items:  items,
      cta:    %{label: "Read all articles", url: "/ext/blog"}
    }
  end

  def handle_digest_section(_key, _period, _settings), do: %{items: []}

  @impl true
  def handle_event(_event, _payload, _settings), do: :ok
end

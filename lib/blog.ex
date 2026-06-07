defmodule Blog do
  @moduledoc """
  Blog extension for Nexus.

  A full-featured community blog with categories, hero images, rich articles,
  and digest integration. Built in stages:

  - Stage 1: Categories management (admin panel)
  - Stage 2: Article CRUD + composer + admin articles tab
  - Stage 3: Public blog index + article reading view + inline image uploads
  - Stage 4: Right sidebar widgets (feed highlight, blog-page recent + categories)
  - Stage 5: Digest section + settings + polish

  ## Tables

  - `blog_categories` — admin-managed categories with color and FA icon
  - `blog_articles`   — articles with status, hero image, body, author
  - `blog_images`     — inline image upload tracking for cleanup (Stage 3)
  """

  use Nexus.Extensions.Behaviour

  import Ecto.Query
  alias Nexus.Repo

  @impl true
  def migrations do
    [
      Blog.Migrations.V1CreateBlogCategories,
      Blog.Migrations.V2CreateBlogArticles
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

  @impl true
  def handle_event(_event, _payload, _settings), do: :ok
end

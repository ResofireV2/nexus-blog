defmodule Blog.ApiRouter do
  use Plug.Router

  import Plug.Conn
  import Ecto.Query

  alias Nexus.Repo
  alias Nexus.Extensions.Permissions

  plug :match
  plug :dispatch

  # ---------------------------------------------------------------------------
  # Categories
  # ---------------------------------------------------------------------------

  # GET /categories
  # Public — lists all categories with published article counts.
  get "/categories" do
    rows =
      Repo.all(
        from c in "blog_categories",
          left_join: a in "blog_articles",
            on: a.category_id == c.id and a.status == "published",
          group_by: [c.id, c.name, c.slug, c.color, c.icon, c.inserted_at],
          order_by: [asc: c.name],
          select: %{
            id:            c.id,
            name:          c.name,
            slug:          c.slug,
            color:         c.color,
            icon:          c.icon,
            article_count: count(a.id)
          }
      )

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(%{categories: rows}))
  end

  # POST /categories — admin only
  post "/categories" do
    user = conn.assigns[:current_user]

    unless user && user.role == "admin" do
      conn |> put_resp_content_type("application/json") |> send_resp(403, ~s({"error":"Access denied"}))
    else
      params = conn.body_params
      name   = params["name"]
      slug   = params["slug"]
      color  = params["color"] || "#3b82f6"
      icon   = params["icon"]  || "fa-tag"

      cond do
        is_nil(name) || String.trim(name) == "" ->
          conn |> put_resp_content_type("application/json") |> send_resp(422, ~s({"error":"Name is required"}))

        is_nil(slug) || String.trim(slug) == "" ->
          conn |> put_resp_content_type("application/json") |> send_resp(422, ~s({"error":"Slug is required"}))

        not Regex.match?(~r/^#[0-9a-fA-F]{6}$/, color) ->
          conn |> put_resp_content_type("application/json") |> send_resp(422, ~s({"error":"Color must be a valid hex value"}))

        true ->
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          case Repo.insert_all("blog_categories",
            [%{name: String.trim(name), slug: String.trim(slug), color: color,
               icon: String.trim(icon), inserted_at: now, updated_at: now}],
            returning: [:id, :name, :slug, :color, :icon, :inserted_at]
          ) do
            {1, [cat]} ->
              conn |> put_resp_content_type("application/json") |> send_resp(201, Jason.encode!(%{category: cat}))
            _ ->
              conn |> put_resp_content_type("application/json") |> send_resp(500, ~s({"error":"Failed to create category"}))
          end
      end
    end
  end

  # PATCH /categories/:id — admin only
  patch "/categories/:id" do
    user = conn.assigns[:current_user]

    unless user && user.role == "admin" do
      conn |> put_resp_content_type("application/json") |> send_resp(403, ~s({"error":"Access denied"}))
    else
      category_id = parse_id(id)

      if is_nil(category_id) do
        conn |> put_resp_content_type("application/json") |> send_resp(400, ~s({"error":"Invalid id"}))
      else
        existing = Repo.one(from c in "blog_categories", where: c.id == ^category_id, select: c.id)

        if is_nil(existing) do
          conn |> put_resp_content_type("application/json") |> send_resp(404, ~s({"error":"Category not found"}))
        else
          params  = conn.body_params
          updates = %{updated_at: DateTime.utc_now() |> DateTime.truncate(:second)}
          updates = if v = params["name"],  do: Map.put(updates, :name,  String.trim(v)), else: updates
          updates = if v = params["slug"],  do: Map.put(updates, :slug,  String.trim(v)), else: updates
          updates = if v = params["color"], do: Map.put(updates, :color, v),              else: updates
          updates = if v = params["icon"],  do: Map.put(updates, :icon,  String.trim(v)), else: updates

          Repo.update_all(from(c in "blog_categories", where: c.id == ^category_id), set: Map.to_list(updates))

          cat = Repo.one(from c in "blog_categories", where: c.id == ^category_id,
            select: %{id: c.id, name: c.name, slug: c.slug, color: c.color, icon: c.icon})

          conn |> put_resp_content_type("application/json") |> send_resp(200, Jason.encode!(%{category: cat}))
        end
      end
    end
  end

  # DELETE /categories/:id — admin only
  delete "/categories/:id" do
    user = conn.assigns[:current_user]

    unless user && user.role == "admin" do
      conn |> put_resp_content_type("application/json") |> send_resp(403, ~s({"error":"Access denied"}))
    else
      category_id = parse_id(id)

      if is_nil(category_id) do
        conn |> put_resp_content_type("application/json") |> send_resp(400, ~s({"error":"Invalid id"}))
      else
        Repo.delete_all(from c in "blog_categories", where: c.id == ^category_id)
        conn |> put_resp_content_type("application/json") |> send_resp(200, ~s({"ok":true}))
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Articles
  # ---------------------------------------------------------------------------

  # GET /articles
  # Returns published articles only (for public view).
  # Query params: category_slug, page (default 1), per_page (default 20).
  get "/articles" do
    user          = conn.assigns[:current_user]
    params        = conn.query_params
    page          = parse_page(params["page"])
    per_page      = 20
    offset        = (page - 1) * per_page
    cat_slug      = params["category"]
    include_drafts = params["include_drafts"] == "true" && user && user.role == "admin"

    base =
      from a in "blog_articles",
        left_join: c in "blog_categories", on: c.id == a.category_id,
        left_join: u in "users", on: u.id == a.author_id,
        order_by: [desc: a.published_at, desc: a.inserted_at],
        limit: ^per_page,
        offset: ^offset,
        select: %{
          id:                    a.id,
          title:                 a.title,
          slug:                  a.slug,
          status:                a.status,
          hero_image_url:        a.hero_image_url,
          reading_time_minutes:  a.reading_time_minutes,
          published_at:          a.published_at,
          inserted_at:           a.inserted_at,
          category_id:           a.category_id,
          category_name:         c.name,
          category_slug:         c.slug,
          category_color:        c.color,
          category_icon:         c.icon,
          author_id:             a.author_id,
          author_username:       u.username,
          author_avatar_url:     u.avatar_url,
          author_avatar_color:   u.avatar_color
        }

    base = if include_drafts, do: base, else: from [a, ..] in base, where: a.status == "published"

    base =
      if cat_slug && cat_slug != "" do
        from [a, c, ..] in base, where: c.slug == ^cat_slug
      else
        base
      end

    articles = Repo.all(base)

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(%{articles: articles, page: page}))
  end

  # GET /articles/:slug_or_id
  # Returns a single article. Drafts only visible to admins and the author.
  get "/articles/:slug_or_id" do
    user = conn.assigns[:current_user]

    article =
      Repo.one(
        from a in "blog_articles",
          left_join: c in "blog_categories", on: c.id == a.category_id,
          left_join: u in "users", on: u.id == a.author_id,
          where: a.slug == ^slug_or_id,
          select: %{
            id:                    a.id,
            title:                 a.title,
            slug:                  a.slug,
            body:                  a.body,
            status:                a.status,
            hero_image_url:        a.hero_image_url,
            reading_time_minutes:  a.reading_time_minutes,
            published_at:          a.published_at,
            inserted_at:           a.inserted_at,
            category_id:           a.category_id,
            category_name:         c.name,
            category_slug:         c.slug,
            category_color:        c.color,
            category_icon:         c.icon,
            author_id:             a.author_id,
            author_username:       u.username,
            author_avatar_url:     u.avatar_url,
            author_avatar_color:   u.avatar_color
          }
      )

    cond do
      is_nil(article) ->
        conn |> put_resp_content_type("application/json") |> send_resp(404, ~s({"error":"Article not found"}))

      article.status == "draft" && !can_edit_article?(user, article) ->
        conn |> put_resp_content_type("application/json") |> send_resp(404, ~s({"error":"Article not found"}))

      true ->
        conn |> put_resp_content_type("application/json") |> send_resp(200, Jason.encode!(%{article: article}))
    end
  end

  # POST /articles — requires can_write_articles
  post "/articles" do
    user = conn.assigns[:current_user]

    case Permissions.check("blog", "can_write_articles", user) do
      :error ->
        conn |> put_resp_content_type("application/json") |> send_resp(403, ~s({"error":"Access denied"}))

      :ok ->
        params  = conn.body_params
        title   = params["title"]
        body    = params["body"] || ""
        cat_id  = parse_id(params["category_id"])
        hero    = params["hero_image_url"]

        if is_nil(title) || String.trim(title) == "" do
          conn |> put_resp_content_type("application/json") |> send_resp(422, ~s({"error":"Title is required"}))
        else
          slug     = unique_slug(String.trim(title))
          reading  = reading_time(body)
          now      = DateTime.utc_now() |> DateTime.truncate(:second)

          case Repo.insert_all("blog_articles",
            [%{
              title:                 String.trim(title),
              slug:                  slug,
              body:                  body,
              status:                "draft",
              hero_image_url:        hero,
              reading_time_minutes:  reading,
              category_id:           cat_id,
              author_id:             user.id,
              inserted_at:           now,
              updated_at:            now
            }],
            returning: [:id, :slug, :status]
          ) do
            {1, [article]} ->
              conn |> put_resp_content_type("application/json") |> send_resp(201, Jason.encode!(%{article: article}))
            _ ->
              conn |> put_resp_content_type("application/json") |> send_resp(500, ~s({"error":"Failed to create article"}))
          end
        end
    end
  end

  # PATCH /articles/:id — author or admin
  patch "/articles/:id" do
    user = conn.assigns[:current_user]
    article_id = parse_id(id)

    if is_nil(article_id) do
      conn |> put_resp_content_type("application/json") |> send_resp(400, ~s({"error":"Invalid id"}))
    else
      article = Repo.one(from a in "blog_articles", where: a.id == ^article_id,
        select: %{id: a.id, author_id: a.author_id, status: a.status})

      cond do
        is_nil(article) ->
          conn |> put_resp_content_type("application/json") |> send_resp(404, ~s({"error":"Article not found"}))

        !can_edit_article?(user, article) ->
          conn |> put_resp_content_type("application/json") |> send_resp(403, ~s({"error":"Access denied"}))

        true ->
          params  = conn.body_params
          updates = %{updated_at: DateTime.utc_now() |> DateTime.truncate(:second)}
          updates = if v = params["title"],          do: Map.put(updates, :title,                String.trim(v)), else: updates
          updates = if v = params["body"],           do: Map.merge(updates, %{body: v, reading_time_minutes: reading_time(v)}), else: updates
          updates = if Map.has_key?(params, "category_id"), do: Map.put(updates, :category_id, parse_id(params["category_id"])), else: updates
          updates = if Map.has_key?(params, "hero_image_url"), do: Map.put(updates, :hero_image_url, params["hero_image_url"]), else: updates

          Repo.update_all(from(a in "blog_articles", where: a.id == ^article_id), set: Map.to_list(updates))

          updated = Repo.one(
            from a in "blog_articles",
              left_join: c in "blog_categories", on: c.id == a.category_id,
              left_join: u in "users", on: u.id == a.author_id,
              where: a.id == ^article_id,
              select: %{id: a.id, title: a.title, slug: a.slug, body: a.body,
                status: a.status, hero_image_url: a.hero_image_url,
                reading_time_minutes: a.reading_time_minutes,
                category_id: a.category_id, category_name: c.name,
                author_id: a.author_id, author_username: u.username}
          )

          conn |> put_resp_content_type("application/json") |> send_resp(200, Jason.encode!(%{article: updated}))
      end
    end
  end

  # PATCH /articles/:id/publish — requires can_publish_articles
  patch "/articles/:id/publish" do
    user = conn.assigns[:current_user]

    case Permissions.check("blog", "can_publish_articles", user) do
      :error ->
        conn |> put_resp_content_type("application/json") |> send_resp(403, ~s({"error":"Access denied"}))

      :ok ->
        article_id = parse_id(id)
        article    = article_id && Repo.one(from a in "blog_articles", where: a.id == ^article_id,
          select: %{id: a.id, status: a.status, published_at: a.published_at})

        if is_nil(article) do
          conn |> put_resp_content_type("application/json") |> send_resp(404, ~s({"error":"Article not found"}))
        else
          now = DateTime.utc_now() |> DateTime.truncate(:second)
          published_at = article.published_at || now

          Repo.update_all(
            from(a in "blog_articles", where: a.id == ^article_id),
            set: [status: "published", published_at: published_at, updated_at: now]
          )

          conn |> put_resp_content_type("application/json") |> send_resp(200, ~s({"ok":true,"status":"published"}))
        end
    end
  end

  # PATCH /articles/:id/unpublish — requires can_publish_articles
  patch "/articles/:id/unpublish" do
    user = conn.assigns[:current_user]

    case Permissions.check("blog", "can_publish_articles", user) do
      :error ->
        conn |> put_resp_content_type("application/json") |> send_resp(403, ~s({"error":"Access denied"}))

      :ok ->
        article_id = parse_id(id)
        article    = article_id && Repo.one(from a in "blog_articles", where: a.id == ^article_id, select: a.id)

        if is_nil(article) do
          conn |> put_resp_content_type("application/json") |> send_resp(404, ~s({"error":"Article not found"}))
        else
          now = DateTime.utc_now() |> DateTime.truncate(:second)
          Repo.update_all(
            from(a in "blog_articles", where: a.id == ^article_id),
            set: [status: "draft", updated_at: now]
          )
          conn |> put_resp_content_type("application/json") |> send_resp(200, ~s({"ok":true,"status":"draft"}))
        end
    end
  end

  # DELETE /articles/:id — author or admin
  delete "/articles/:id" do
    user       = conn.assigns[:current_user]
    article_id = parse_id(id)

    if is_nil(article_id) do
      conn |> put_resp_content_type("application/json") |> send_resp(400, ~s({"error":"Invalid id"}))
    else
      article = Repo.one(from a in "blog_articles", where: a.id == ^article_id,
        select: %{id: a.id, author_id: a.author_id})

      cond do
        is_nil(article) ->
          conn |> put_resp_content_type("application/json") |> send_resp(404, ~s({"error":"Article not found"}))

        !can_edit_article?(user, article) ->
          conn |> put_resp_content_type("application/json") |> send_resp(403, ~s({"error":"Access denied"}))

        true ->
          Repo.delete_all(from a in "blog_articles", where: a.id == ^article_id)
          conn |> put_resp_content_type("application/json") |> send_resp(200, ~s({"ok":true}))
      end
    end
  end

  match _ do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(404, ~s({"error":"not found"}))
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp parse_id(value) when is_integer(value) and value > 0, do: value
  defp parse_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {id, ""} when id > 0 -> id
      _ -> nil
    end
  end
  defp parse_id(_), do: nil

  defp parse_page(value) when is_binary(value) do
    case Integer.parse(value) do
      {p, ""} when p > 0 -> p
      _ -> 1
    end
  end
  defp parse_page(_), do: 1

  # ~200 words per minute, minimum 1 minute.
  defp reading_time(body) when is_binary(body) do
    words = body |> String.split(~r/\s+/, trim: true) |> length()
    max(1, div(words, 200))
  end
  defp reading_time(_), do: 1

  # Generates a URL-safe slug from a title. Appends a short random suffix to
  # avoid collisions without a uniqueness query (slug has a unique index).
  defp unique_slug(title) do
    base =
      title
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/, "-")
      |> String.trim("-")
      |> String.slice(0, 80)

    suffix = :crypto.strong_rand_bytes(3) |> Base.encode16(case: :lower)
    "#{base}-#{suffix}"
  end

  # A user can edit an article if they are the author or an admin.
  defp can_edit_article?(nil, _article), do: false
  defp can_edit_article?(%{role: "admin"}, _article), do: true
  defp can_edit_article?(user, article), do: user.id == article.author_id
end

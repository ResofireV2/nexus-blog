defmodule Blog.ApiRouter do
  use Plug.Router

  import Plug.Conn
  import Ecto.Query

  alias Nexus.Repo

  plug :match
  plug :dispatch

  # ---------------------------------------------------------------------------
  # Categories
  # ---------------------------------------------------------------------------

  # GET /categories
  # Public — lists all categories with article counts (articles table added in V2).
  # For Stage 1, returns categories without counts.
  get "/categories" do
    categories =
      Repo.all(
        from c in "blog_categories",
          order_by: [asc: c.name],
          select: %{
            id:         c.id,
            name:       c.name,
            slug:       c.slug,
            color:      c.color,
            icon:       c.icon,
            inserted_at: c.inserted_at
          }
      )

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(%{categories: categories}))
  end

  # POST /categories
  # Admin only.
  post "/categories" do
    user = conn.assigns[:current_user]

    unless user && user.role == "admin" do
      conn
      |> put_resp_content_type("application/json")
      |> send_resp(403, ~s({"error":"Access denied"}))
    else
      params = conn.body_params
      name   = params["name"]
      slug   = params["slug"]
      color  = params["color"] || "#3b82f6"
      icon   = params["icon"]  || "fa-tag"

      cond do
        is_nil(name) || String.trim(name) == "" ->
          conn
          |> put_resp_content_type("application/json")
          |> send_resp(422, ~s({"error":"Name is required"}))

        is_nil(slug) || String.trim(slug) == "" ->
          conn
          |> put_resp_content_type("application/json")
          |> send_resp(422, ~s({"error":"Slug is required"}))

        not Regex.match?(~r/^#[0-9a-fA-F]{6}$/, color) ->
          conn
          |> put_resp_content_type("application/json")
          |> send_resp(422, ~s({"error":"Color must be a valid hex value"}))

        true ->
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          case Repo.insert_all("blog_categories",
            [%{
              name:        String.trim(name),
              slug:        String.trim(slug),
              color:       color,
              icon:        String.trim(icon),
              inserted_at: now,
              updated_at:  now
            }],
            returning: [:id, :name, :slug, :color, :icon, :inserted_at]
          ) do
            {1, [category]} ->
              conn
              |> put_resp_content_type("application/json")
              |> send_resp(201, Jason.encode!(%{category: category}))

            _ ->
              conn
              |> put_resp_content_type("application/json")
              |> send_resp(500, ~s({"error":"Failed to create category"}))
          end
      end
    end
  end

  # PATCH /categories/:id
  # Admin only.
  patch "/categories/:id" do
    user = conn.assigns[:current_user]

    unless user && user.role == "admin" do
      conn
      |> put_resp_content_type("application/json")
      |> send_resp(403, ~s({"error":"Access denied"}))
    else
      category_id = parse_id(id)

      if is_nil(category_id) do
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(400, ~s({"error":"Invalid id"}))
      else
        existing =
          Repo.one(
            from c in "blog_categories",
              where: c.id == ^category_id,
              select: c.id
          )

        if is_nil(existing) do
          conn
          |> put_resp_content_type("application/json")
          |> send_resp(404, ~s({"error":"Category not found"}))
        else
          params  = conn.body_params
          updates = %{updated_at: DateTime.utc_now() |> DateTime.truncate(:second)}

          updates =
            if v = params["name"],  do: Map.put(updates, :name,  String.trim(v)), else: updates
          updates =
            if v = params["slug"],  do: Map.put(updates, :slug,  String.trim(v)), else: updates
          updates =
            if v = params["color"], do: Map.put(updates, :color, v),              else: updates
          updates =
            if v = params["icon"],  do: Map.put(updates, :icon,  String.trim(v)), else: updates

          Repo.update_all(
            from(c in "blog_categories", where: c.id == ^category_id),
            set: Map.to_list(updates)
          )

          category =
            Repo.one(
              from c in "blog_categories",
                where: c.id == ^category_id,
                select: %{id: c.id, name: c.name, slug: c.slug, color: c.color, icon: c.icon}
            )

          conn
          |> put_resp_content_type("application/json")
          |> send_resp(200, Jason.encode!(%{category: category}))
        end
      end
    end
  end

  # DELETE /categories/:id
  # Admin only. Nullifies article category_id (enforced by FK in V2 migration).
  delete "/categories/:id" do
    user = conn.assigns[:current_user]

    unless user && user.role == "admin" do
      conn
      |> put_resp_content_type("application/json")
      |> send_resp(403, ~s({"error":"Access denied"}))
    else
      category_id = parse_id(id)

      if is_nil(category_id) do
        conn
        |> put_resp_content_type("application/json")
        |> send_resp(400, ~s({"error":"Invalid id"}))
      else
        Repo.delete_all(
          from c in "blog_categories", where: c.id == ^category_id
        )

        conn
        |> put_resp_content_type("application/json")
        |> send_resp(200, ~s({"ok":true}))
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
end

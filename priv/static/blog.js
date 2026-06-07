// blog.js — Nexus Blog extension bundle
(function () {
  "use strict";

  const NE   = window.NexusExtensions;
  const SLUG = "blog";
  const { useState, useEffect, useRef, useCallback } = window.React;
  const { toast } = window.NexusComponents;

  const PRESET_COLORS = [
    "#3b82f6", "#34d399", "#fbbf24", "#f472b6",
    "#f87171", "#a78bfa", "#fb923c", "#22d3ee",
    "#e2e8f0"
  ];

  const CATEGORY_ICONS = [
    "fa-bullhorn", "fa-book-open", "fa-code", "fa-users",
    "fa-rocket", "fa-fire", "fa-lightbulb", "fa-shield-halved",
    "fa-chart-bar", "fa-gamepad", "fa-globe", "fa-star",
    "fa-flag", "fa-wrench", "fa-newspaper", "fa-graduation-cap",
    "fa-handshake", "fa-trophy", "fa-calendar", "fa-tag"
  ];

  const DEFAULT_COLOR = "#3b82f6";
  const DEFAULT_ICON  = "fa-tag";

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toSlug(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function isValidHex(v) {
    return /^#[0-9a-fA-F]{6}$/.test(v);
  }

  function token() {
    return localStorage.getItem("nexus_token");
  }

  function authHeaders() {
    var t = token();
    return t
      ? { "authorization": "Bearer " + t, "content-type": "application/json" }
      : { "content-type": "application/json" };
  }

  function apiGet(path) {
    return fetch("/ext/" + SLUG + "/api" + path, { headers: authHeaders() })
      .then(function (r) { return r.json(); });
  }

  function apiPost(path, body) {
    return fetch("/ext/" + SLUG + "/api" + path, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  function apiPatch(path, body) {
    return fetch("/ext/" + SLUG + "/api" + path, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  function apiDelete(path) {
    return fetch("/ext/" + SLUG + "/api" + path, {
      method: "DELETE",
      headers: authHeaders()
    }).then(function (r) { return r.json(); });
  }

  // Reading time — ~200 wpm, minimum 1.
  function readingTime(body) {
    if (!body) return 1;
    var words = body.trim().split(/\s+/).filter(function (w) { return w.length > 0; }).length;
    return Math.max(1, Math.round(words / 200));
  }

  // Format published_at or inserted_at for display.
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ── ColorPicker — matches FormHelpers.jsx exactly ─────────────────────────

  function ColorPicker({ value, onChange }) {
    var inputRef = useRef();
    var valid = isValidHex(value);
    var R = window.React.createElement;
    return R("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
      R("div", { style: { position: "relative", width: 36, height: 36, flexShrink: 0 } },
        R("div", {
          style: {
            width: 36, height: 36, borderRadius: 8,
            background: valid ? value : "rgba(255,255,255,0.1)",
            border: "0.5px solid var(--b2)", cursor: "pointer"
          },
          onClick: function () { inputRef.current && inputRef.current.click(); }
        }),
        R("input", {
          ref: inputRef, type: "color",
          value: valid ? value : DEFAULT_COLOR,
          onChange: function (e) { onChange(e.target.value); },
          style: { position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }
        })
      ),
      R("input", {
        className: "fi",
        value: value || "",
        onChange: function (e) { onChange(e.target.value); },
        placeholder: DEFAULT_COLOR,
        style: { fontFamily: "monospace", maxWidth: 160 }
      })
    );
  }

  // ── Category badge preview ─────────────────────────────────────────────────

  function CategoryPreview({ name, color, icon }) {
    if (!name) return null;
    var bg     = isValidHex(color) ? color + "1a" : "rgba(255,255,255,0.08)";
    var border = isValidHex(color) ? color + "40" : "rgba(255,255,255,0.15)";
    var R = window.React.createElement;
    return R("span", {
      style: {
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 20,
        background: bg, color: color || "var(--t3)",
        border: "0.5px solid " + border
      }
    },
      icon && R("i", { className: "fa-solid " + icon, style: { fontSize: 9 } }),
      name
    );
  }

  // ── Category badge (compact, for article cards/rows) ──────────────────────

  function CategoryBadge({ name, color, icon }) {
    if (!name) return null;
    var bg     = (color || "#888") + "1a";
    var border = (color || "#888") + "40";
    var R = window.React.createElement;
    return R("span", {
      style: {
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 20,
        textTransform: "uppercase", letterSpacing: "0.4px",
        background: bg, color: color || "var(--t3)",
        border: "0.5px solid " + border
      }
    },
      icon && R("i", { className: "fa-solid " + icon, style: { fontSize: 8 } }),
      name
    );
  }

  // ── Category form ──────────────────────────────────────────────────────────

  function CategoryForm({ initial, onSave, onCancel, saving }) {
    var isNew = !initial;
    var [form, setForm] = useState(initial || {
      name: "", slug: "", color: DEFAULT_COLOR, icon: DEFAULT_ICON
    });
    var [slugEdited, setSlugEdited] = useState(!isNew);
    var R = window.React.createElement;

    function set(key, val) {
      setForm(function (p) { return Object.assign({}, p, { [key]: val }); });
    }

    function handleNameChange(e) {
      var name = e.target.value;
      set("name", name);
      if (!slugEdited) set("slug", toSlug(name));
    }

    return R("div", {
      style: {
        background: "rgba(59,130,246,0.05)",
        border: "0.5px solid rgba(59,130,246,0.18)",
        borderRadius: 12, padding: "20px 22px", marginTop: 4
      }
    },
      R("div", { style: { fontSize: 13, fontWeight: 500, color: "var(--ac-text)", marginBottom: 18 } },
        isNew ? "New category" : "Edit category"
      ),
      R("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 } },
        R("div", null,
          R("label", { className: "f-label" }, "Name"),
          R("input", { className: "fi", value: form.name, onChange: handleNameChange,
            placeholder: "e.g. Tutorials", style: { fontSize: 13, padding: "9px 13px" } })
        ),
        R("div", null,
          R("label", { className: "f-label" }, "Slug"),
          R("input", { className: "fi", value: form.slug,
            onChange: function (e) { setSlugEdited(true); set("slug", e.target.value); },
            placeholder: "auto-generated",
            style: { fontSize: 13, padding: "9px 13px", fontFamily: "monospace", color: "var(--t3)" } }),
          R("div", { className: "f-hint" }, "Used in URLs · auto-generated from name")
        )
      ),
      R("div", { style: { marginBottom: 16 } },
        R("label", { className: "f-label" }, "Color"),
        R(ColorPicker, { value: form.color, onChange: function (v) { set("color", v); } }),
        R("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 } },
          PRESET_COLORS.map(function (c) {
            return R("div", {
              key: c,
              onClick: function () { set("color", c); },
              style: {
                width: 22, height: 22, borderRadius: "50%", background: c,
                cursor: "pointer", flexShrink: 0,
                border: form.color === c ? "2px solid #fff" : "2px solid transparent",
                transform: form.color === c ? "scale(1.18)" : "scale(1)",
                transition: "all .12s"
              }
            });
          })
        )
      ),
      R("div", { style: { marginBottom: 16 } },
        R("label", { className: "f-label" },
          "Icon ",
          R("span", { style: { fontSize: 10, color: "var(--t5)", marginLeft: 4, textTransform: "none", letterSpacing: 0 } },
            "(Font Awesome class)"
          )
        ),
        R("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
          R("div", {
            style: {
              width: 36, height: 36, borderRadius: 8,
              background: "rgba(255,255,255,0.05)", border: "0.5px solid var(--b2)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }
          },
            R("i", {
              className: "fa-solid " + (form.icon || DEFAULT_ICON),
              style: { fontSize: 15, color: isValidHex(form.color) ? form.color : "var(--t3)" }
            })
          ),
          R("input", {
            className: "fi", value: form.icon || "",
            onChange: function (e) { set("icon", e.target.value); },
            placeholder: DEFAULT_ICON,
            style: { fontFamily: "monospace", fontSize: 12 }
          })
        ),
        R("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 } },
          CATEGORY_ICONS.map(function (ic) {
            return R("button", {
              key: ic, title: ic,
              style: {
                width: 32, height: 32, borderRadius: 7, cursor: "pointer",
                background: form.icon === ic ? "var(--ac-bg)" : "var(--s2)",
                border: "0.5px solid " + (form.icon === ic ? "var(--ac-border)" : "var(--b1)"),
                color: form.icon === ic
                  ? (isValidHex(form.color) ? form.color : "var(--ac-text)")
                  : "var(--t4)",
                display: "flex", alignItems: "center", justifyContent: "center"
              },
              onMouseDown: function (e) { e.preventDefault(); set("icon", ic); }
            },
              R("i", { className: "fa-solid " + ic, style: { fontSize: 13 } })
            );
          })
        ),
        R("div", { className: "f-hint" }, "Icon inherits the category color automatically")
      ),
      R("div", { style: { marginBottom: 20 } },
        R("label", { className: "f-label" }, "Preview"),
        R(CategoryPreview, { name: form.name || "Category name", color: form.color, icon: form.icon }),
        R("div", { className: "f-hint", style: { marginTop: 8 } },
          "How the badge appears on article cards and filter pills"
        )
      ),
      R("div", { style: { display: "flex", gap: 8 } },
        R("button", {
          className: "btn-primary",
          style: { fontSize: 13, padding: "8px 20px" },
          disabled: saving || !form.name.trim() || !form.slug.trim(),
          onClick: function () { onSave(form); }
        }, saving ? "Saving\u2026" : (isNew ? "Create category" : "Save changes")),
        R("button", { className: "btn-ghost", onClick: onCancel }, "Cancel")
      )
    );
  }

  // ── Categories tab ────────────────────────────────────────────────────────

  function CategoriesTab() {
    var [categories, setCategories] = useState(null);
    var [showForm, setShowForm]     = useState(false);
    var [editing, setEditing]       = useState(null);
    var [saving, setSaving]         = useState(false);
    var [deleting, setDeleting]     = useState(null);
    var R = window.React.createElement;

    var load = useCallback(function () {
      apiGet("/categories").then(function (d) {
        setCategories(d.categories || []);
      }).catch(function () { setCategories([]); });
    }, []);

    useEffect(function () { load(); }, [load]);

    function handleSave(form) {
      setSaving(true);
      var isNew = !editing;
      var p = isNew
        ? apiPost("/categories", form)
        : apiPatch("/categories/" + editing.id, form);

      p.then(function (d) {
        if (d.error) { toast(d.error, "err"); }
        else {
          toast(isNew ? "Category created." : "Category updated.");
          setShowForm(false); setEditing(null); load();
        }
      }).catch(function () { toast("Failed to save category.", "err"); })
        .finally(function () { setSaving(false); });
    }

    function handleDelete(cat) {
      if (!window.confirm("Delete \"" + cat.name + "\"? Articles in this category will be uncategorised.")) return;
      setDeleting(cat.id);
      apiDelete("/categories/" + cat.id).then(function (d) {
        if (d.error) { toast(d.error, "err"); }
        else { toast("Category deleted."); load(); }
      }).catch(function () { toast("Failed to delete category.", "err"); })
        .finally(function () { setDeleting(null); });
    }

    if (categories === null) {
      return R("div", { style: { color: "var(--t4)", fontSize: 13, padding: "20px 0" } }, "Loading\u2026");
    }

    return R("div", null,
      categories.length > 0 && R("div", { className: "panel", style: { marginBottom: 20 } },
        R("div", { className: "panel-title" },
          R("span", null, categories.length + " " + (categories.length === 1 ? "category" : "categories"))
        ),
        R("table", { className: "atbl" },
          R("thead", null,
            R("tr", null,
              R("th", null, "Category"),
              R("th", null, "Icon"),
              R("th", null, "Color"),
              R("th", null)
            )
          ),
          R("tbody", null,
            categories.map(function (cat) {
              return R("tr", { key: cat.id },
                R("td", null,
                  R("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                    R("span", { style: { width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0, display: "inline-block" } }),
                    R("span", { style: { color: "var(--t1)", fontWeight: 500 } }, cat.name)
                  )
                ),
                R("td", null, R("i", { className: "fa-solid " + cat.icon, style: { fontSize: 13, color: cat.color } })),
                R("td", null,
                  R("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
                    R("div", { style: { width: 14, height: 14, borderRadius: "50%", background: cat.color, flexShrink: 0 } }),
                    R("span", { style: { fontSize: 12, fontFamily: "monospace", color: "var(--t4)" } }, cat.color)
                  )
                ),
                R("td", null,
                  R("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                    R("button", {
                      className: "btn-ghost",
                      style: { fontSize: 12, padding: "5px 14px" },
                      onClick: function () { setEditing(cat); setShowForm(true); }
                    }, "Edit"),
                    R("button", {
                      className: "btn-ghost",
                      disabled: deleting === cat.id,
                      style: { fontSize: 12, padding: "5px 14px", borderColor: "rgba(248,113,113,0.3)", color: deleting === cat.id ? "var(--t4)" : "var(--red)" },
                      onClick: function () { handleDelete(cat); }
                    }, deleting === cat.id ? "Deleting\u2026" : "Delete")
                  )
                )
              );
            })
          )
        )
      ),
      (showForm || categories.length === 0) && !editing
        ? R(CategoryForm, { initial: null, onSave: handleSave, onCancel: function () { setShowForm(false); }, saving: saving })
        : editing
          ? R(CategoryForm, { initial: editing, onSave: handleSave, onCancel: function () { setEditing(null); setShowForm(false); }, saving: saving })
          : R("button", {
              className: "btn-ghost", style: { marginTop: 4 },
              onClick: function () { setEditing(null); setShowForm(true); }
            }, "+ New category")
    );
  }

  // ── Articles tab ───────────────────────────────────────────────────────────

  function ArticlesTab({ navigate }) {
    var [articles, setArticles] = useState(null);
    var [stats, setStats]       = useState({ published: 0, drafts: 0, categories: 0 });
    var [deleting, setDeleting] = useState(null);
    var [toggling, setToggling] = useState(null);
    var R = window.React.createElement;

    var load = useCallback(function () {
      Promise.all([
        apiGet("/articles?include_drafts=true"),
        apiGet("/categories")
      ]).then(function (results) {
        var arts  = results[0].articles || [];
        var cats  = results[1].categories || [];
        setArticles(arts);
        setStats({
          published:  arts.filter(function (a) { return a.status === "published"; }).length,
          drafts:     arts.filter(function (a) { return a.status === "draft"; }).length,
          categories: cats.length
        });
      }).catch(function () { setArticles([]); });
    }, []);

    useEffect(function () { load(); }, [load]);

    function handleDelete(art) {
      if (!window.confirm("Delete \"" + art.title + "\"? This cannot be undone.")) return;
      setDeleting(art.id);
      apiDelete("/articles/" + art.id).then(function (d) {
        if (d.error) { toast(d.error, "err"); }
        else { toast("Article deleted."); load(); }
      }).catch(function () { toast("Failed to delete article.", "err"); })
        .finally(function () { setDeleting(null); });
    }

    function handleToggleStatus(art) {
      setToggling(art.id);
      var path = art.status === "published"
        ? "/articles/" + art.id + "/unpublish"
        : "/articles/" + art.id + "/publish";

      apiPatch(path, {}).then(function (d) {
        if (d.error) { toast(d.error, "err"); }
        else {
          toast(d.status === "published" ? "Article published." : "Article unpublished.");
          load();
        }
      }).catch(function () { toast("Failed to update article.", "err"); })
        .finally(function () { setToggling(null); });
    }

    if (articles === null) {
      return R("div", { style: { color: "var(--t4)", fontSize: 13, padding: "20px 0" } }, "Loading\u2026");
    }

    var statusBadge = function (status) {
      var isPublished = status === "published";
      return R("span", {
        className: "sp-tag",
        style: {
          color:        isPublished ? "rgba(52,211,153,0.9)" : "rgba(255,255,255,0.45)",
          borderColor:  isPublished ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.12)",
          background:   isPublished ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.04)"
        }
      }, status);
    };

    return R("div", null,
      // Stat cards
      R("div", { className: "admin-stat-row", style: { marginBottom: 24 } },
        [
          { icon: "fa-newspaper",  color: "#3b82f6", n: stats.published,  label: "published" },
          { icon: "fa-pen-to-square", color: "#94a3b8", n: stats.drafts,  label: "drafts" },
          { icon: "fa-tag",        color: "#a78bfa", n: stats.categories, label: "categories" }
        ].map(function (c, i) {
          return R("div", { key: i, className: "admin-stat-card" },
            R("div", { className: "asc-icon", style: { background: c.color + "18" } },
              R("i", { className: "fa-solid " + c.icon, style: { color: c.color, fontSize: 15 } })
            ),
            R("div", { className: "asc-n", style: { color: c.color } }, c.n),
            R("div", { className: "asc-l" }, c.label)
          );
        })
      ),

      // New article button
      R("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 16 } },
        R("button", {
          className: "btn-primary",
          style: { fontSize: 13, padding: "7px 18px" },
          onClick: function () { NE.navigate("/ext/" + SLUG + "/compose"); }
        }, "+ New article")
      ),

      // Articles table
      articles.length === 0
        ? R("div", {
            style: { color: "var(--t4)", fontSize: 13, padding: "32px 0", textAlign: "center" }
          }, "No articles yet. Click \u201c+ New article\u201d to get started.")
        : R("div", { className: "panel" },
            R("table", { className: "atbl" },
              R("thead", null,
                R("tr", null,
                  R("th", null, "Title"),
                  R("th", null, "Category"),
                  R("th", null, "Author"),
                  R("th", null, "Status"),
                  R("th", null, "Date"),
                  R("th", null)
                )
              ),
              R("tbody", null,
                articles.map(function (art) {
                  return R("tr", { key: art.id },
                    R("td", null,
                      R("span", {
                        style: { color: "var(--t1)", fontWeight: 500, cursor: "pointer" },
                        onClick: function () { NE.navigate("/ext/" + SLUG + "/compose/" + art.id); }
                      }, art.title)
                    ),
                    R("td", null,
                      art.category_name
                        ? R(CategoryBadge, { name: art.category_name, color: art.category_color, icon: art.category_icon })
                        : R("span", { style: { color: "var(--t5)", fontSize: 12 } }, "\u2014")
                    ),
                    R("td", null, R("span", { style: { fontSize: 13 } }, art.author_username || "\u2014")),
                    R("td", null, statusBadge(art.status)),
                    R("td", null, R("span", { style: { fontSize: 12, color: "var(--t4)" } },
                      fmtDate(art.published_at || art.inserted_at)
                    )),
                    R("td", null,
                      R("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                        R("button", {
                          className: "btn-ghost",
                          style: { fontSize: 12, padding: "5px 14px" },
                          onClick: function () { NE.navigate("/ext/" + SLUG + "/compose/" + art.id); }
                        }, "Edit"),
                        R("button", {
                          className: "btn-ghost",
                          disabled: toggling === art.id,
                          style: { fontSize: 12, padding: "5px 14px" },
                          onClick: function () { handleToggleStatus(art); }
                        }, toggling === art.id
                          ? "\u2026"
                          : art.status === "published" ? "Unpublish" : "Publish"
                        ),
                        R("button", {
                          className: "btn-ghost",
                          disabled: deleting === art.id,
                          style: { fontSize: 12, padding: "5px 14px", borderColor: "rgba(248,113,113,0.3)", color: deleting === art.id ? "var(--t4)" : "var(--red)" },
                          onClick: function () { handleDelete(art); }
                        }, deleting === art.id ? "Deleting\u2026" : "Delete")
                      )
                    )
                  );
                })
              )
            )
          )
    );
  }

  // ── Composer ───────────────────────────────────────────────────────────────
  // Registered as a route at /compose (new) and /compose/:id (edit).
  // Extension route components receive { currentUser, navigate, ...params }.
  // The component is rendered inside ExtensionRoutePage's scrollable div:
  //   flex:1; overflowY:auto; padding:0 28px
  // We render our own full-page layout within that container.

  function BlogComposer({ currentUser, navigate, id }) {
    var isEdit      = !!id;
    var articleId   = id ? parseInt(id, 10) : null;
    var R           = window.React.createElement;
    var fileInputRef = useRef();

    var [title,       setTitle]       = useState("");
    var [body,        setBody]        = useState("");
    var [categoryId,  setCategoryId]  = useState("");
    var [heroUrl,     setHeroUrl]     = useState("");
    var [categories,  setCategories]  = useState([]);
    var [loading,     setLoading]     = useState(isEdit);
    var [saving,      setSaving]      = useState(false);
    var [publishing,  setPublishing]  = useState(false);
    var [uploading,   setUploading]   = useState(false);
    var [status,      setStatus]      = useState("draft");
    var [canPublish,  setCanPublish]  = useState(false);
    var taRef = useRef();

    // Load categories and article (if editing)
    useEffect(function () {
      apiGet("/categories").then(function (d) {
        setCategories(d.categories || []);
      });

      if (isEdit && articleId) {
        apiGet("/articles/" + articleId).then(function (d) {
          if (d.article) {
            setTitle(d.article.title || "");
            setBody(d.article.body || "");
            setCategoryId(d.article.category_id ? String(d.article.category_id) : "");
            setHeroUrl(d.article.hero_image_url || "");
            setStatus(d.article.status || "draft");
          }
          setLoading(false);
        }).catch(function () { setLoading(false); });
      } else {
        setLoading(false);
      }

      // Check publish permission — attempt a harmless OPTIONS-like check by
      // seeing if the current user is admin (client-side hint only; server enforces).
      if (currentUser && currentUser.role === "admin") {
        setCanPublish(true);
      }
    }, []);

    // Hero image upload — uses NexusExtensions.uploadFile
    function handleHeroUpload(file) {
      if (!file) return;
      setUploading(true);
      NE.uploadFile(file, { slug: SLUG, type: "extension_image" })
        .then(function (d) {
          if (d.url) { setHeroUrl(d.url); }
          else { toast(d.error || "Upload failed.", "err"); }
        })
        .catch(function () { toast("Upload failed.", "err"); })
        .finally(function () { setUploading(false); });
    }

    // Insert markdown image at cursor in the body textarea
    function insertImage(url) {
      var ta  = taRef.current;
      if (!ta) { setBody(function (b) { return b + "\n![](" + url + ")\n"; }); return; }
      var start = ta.selectionStart;
      var end   = ta.selectionEnd;
      var ins   = "\n![](" + url + ")\n";
      setBody(function (b) { return b.slice(0, start) + ins + b.slice(end); });
      setTimeout(function () {
        ta.selectionStart = ta.selectionEnd = start + ins.length;
        ta.focus();
      }, 0);
    }

    // Inline image upload from toolbar
    function handleInlineImageUpload(file) {
      if (!file) return;
      NE.uploadFile(file, { slug: SLUG, type: "extension_image" })
        .then(function (d) {
          if (d.url) { insertImage(d.url); }
          else { toast(d.error || "Upload failed.", "err"); }
        })
        .catch(function () { toast("Upload failed.", "err"); });
    }

    // Toolbar button: insert markdown wrap around selection
    function applyFormat(wrap) {
      var ta    = taRef.current;
      if (!ta) return;
      var start = ta.selectionStart;
      var end   = ta.selectionEnd;
      var sel   = body.slice(start, end);
      var ins   = wrap[0] + sel + wrap[1];
      setBody(function (b) { return b.slice(0, start) + ins + b.slice(end); });
      setTimeout(function () {
        ta.selectionStart = start + wrap[0].length;
        ta.selectionEnd   = start + wrap[0].length + sel.length;
        ta.focus();
      }, 0);
    }

    function applyPrefix(prefix) {
      var ta    = taRef.current;
      if (!ta) return;
      var start = ta.selectionStart;
      var lineStart = body.lastIndexOf("\n", start - 1) + 1;
      setBody(function (b) { return b.slice(0, lineStart) + prefix + b.slice(lineStart); });
      setTimeout(function () { ta.focus(); }, 0);
    }

    async function save(publishAfter) {
      if (!title.trim()) { toast("Title is required.", "err"); return; }
      setSaving(true);
      try {
        var payload = {
          title:          title.trim(),
          body:           body,
          category_id:    categoryId ? parseInt(categoryId, 10) : null,
          hero_image_url: heroUrl || null
        };

        var d;
        if (isEdit && articleId) {
          d = await apiPatch("/articles/" + articleId, payload);
        } else {
          d = await apiPost("/articles", payload);
        }

        if (d.error) { toast(d.error, "err"); setSaving(false); return; }

        var savedId = d.article ? d.article.id : articleId;

        if (publishAfter && savedId) {
          var pd = await apiPatch("/articles/" + savedId + "/publish", {});
          if (pd.error) { toast(pd.error, "err"); setSaving(false); return; }
          setStatus("published");
          toast("Article published.");
        } else {
          setStatus("draft");
          toast(isEdit ? "Draft saved." : "Article created as draft.");
        }

        // Navigate to admin articles tab after save
        NE.navigate("/ext/" + SLUG + "/compose/" + savedId);
      } catch (e) {
        toast("Failed to save article.", "err");
      } finally {
        setSaving(false);
        setPublishing(false);
      }
    }

    async function unpublish() {
      if (!articleId) return;
      setPublishing(true);
      try {
        var d = await apiPatch("/articles/" + articleId + "/unpublish", {});
        if (d.error) { toast(d.error, "err"); }
        else { setStatus("draft"); toast("Article unpublished."); }
      } catch (e) { toast("Failed to unpublish.", "err"); }
      finally { setPublishing(false); }
    }

    if (loading) {
      return R("div", { style: { padding: "40px 0", color: "var(--t4)", fontSize: 13 } }, "Loading\u2026");
    }

    var mins = readingTime(body);
    var selectedCat = categories.find(function (c) { return String(c.id) === categoryId; });

    // Hero zone
    var heroZone = R("div", {
      style: {
        position: "relative", height: 180, marginBottom: 0,
        background: heroUrl ? "none" : "#1a1a1a",
        borderBottom: "0.5px solid var(--b1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", cursor: heroUrl ? "default" : "pointer",
        flexShrink: 0
      },
      onClick: function () { if (!heroUrl) fileInputRef.current && fileInputRef.current.click(); }
    },
      heroUrl && R("img", {
        src: heroUrl,
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }
      }),
      heroUrl && R("div", {
        style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }
      }),
      !heroUrl && R("div", {
        style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.2)", textAlign: "center" }
      },
        R("div", {
          style: {
            width: 36, height: 36, borderRadius: 10,
            border: "0.5px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.03)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }
        },
          R("i", { className: "fa-solid fa-image", style: { fontSize: 16, color: "rgba(255,255,255,0.2)" } })
        ),
        R("div", { style: { fontSize: 12, color: "rgba(255,255,255,0.25)" } }, "Click to upload a featured image"),
        R("div", { style: { fontSize: 11, color: "rgba(255,255,255,0.15)" } }, "JPEG, PNG or WebP \u00b7 Recommended 1600 \u00d7 900")
      ),
      R("div", { style: { position: "absolute", top: 12, right: 14, display: "flex", gap: 6 } },
        uploading
          ? R("div", { style: { fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.55)", border: "0.5px solid rgba(255,255,255,0.12)" } },
              R("i", { className: "fa-solid fa-spinner fa-spin", style: { marginRight: 5 } }), "Uploading\u2026"
            )
          : R("label", {
              style: { fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.55)", border: "0.5px solid rgba(255,255,255,0.12)", cursor: "pointer" }
            },
              R("input", {
                ref: fileInputRef,
                type: "file", accept: "image/jpeg,image/png,image/webp",
                style: { display: "none" },
                onChange: function (e) { handleHeroUpload(e.target.files[0]); }
              }),
              heroUrl ? "Change image" : "Upload image"
            ),
        heroUrl && R("button", {
          onClick: function (e) { e.stopPropagation(); setHeroUrl(""); },
          style: { fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(0,0,0,0.45)", color: "rgba(248,113,113,0.8)", border: "0.5px solid rgba(248,113,113,0.3)", cursor: "pointer" }
        }, "Remove")
      )
    );

    // Toolbar buttons
    var TB = [
      { label: "B",   tip: "Bold",          style: { fontWeight: 700 },                       wrap: ["**", "**"] },
      { label: "I",   tip: "Italic",        style: { fontStyle: "italic" },                   wrap: ["*", "*"] },
      { label: "S",   tip: "Strikethrough", style: { textDecoration: "line-through" },         wrap: ["~~", "~~"] },
      { sep: true },
      { label: "H1",  tip: "Heading 1",     style: { fontSize: 11, fontWeight: 700 },          prefix: "# " },
      { label: "H2",  tip: "Heading 2",     style: { fontSize: 11, fontWeight: 700 },          prefix: "## " },
      { label: "H3",  tip: "Heading 3",     style: { fontSize: 11, fontWeight: 700 },          prefix: "### " },
      { sep: true },
      { label: "fa-solid fa-link",     tip: "Link",          fa: true, wrap: ["[", "](url)"] },
      { label: "fa-solid fa-image",    tip: "Insert image",  fa: true, image: true },
      { label: "</>", tip: "Code block",    style: { fontFamily: "monospace", fontSize: 11 },  wrap: ["```\n", "\n```"] },
      { label: "\u275d", tip: "Blockquote", style: {},                                          prefix: "> " },
      { label: "\u2014", tip: "Divider",    style: {},                                          wrap: ["\n---\n", ""] },
      { sep: true },
      { label: "fa-solid fa-list-ul", tip: "Bullet list",   fa: true, prefix: "- " },
      { label: "fa-solid fa-list-ol", tip: "Numbered list", fa: true, prefix: "1. " }
    ];

    var inlineImgInputRef = useRef();

    var toolbar = R("div", { className: "comp-toolbar" },
      TB.map(function (b, i) {
        if (b.sep) return R("div", { key: "sep" + i, className: "comp-tb-sep" });
        if (b.image) return R("label", {
          key: "img", className: "comp-tb-btn", title: b.tip, style: { cursor: "pointer" }
        },
          R("input", {
            type: "file", accept: "image/jpeg,image/png,image/webp,image/gif",
            style: { display: "none" },
            onChange: function (e) { handleInlineImageUpload(e.target.files[0]); }
          }),
          R("i", { className: b.label, style: { fontSize: 16 } })
        );
        return R("button", {
          key: i, className: "comp-tb-btn", title: b.tip, style: b.style || {},
          onMouseDown: function (e) {
            e.preventDefault();
            if (b.wrap)   applyFormat(b.wrap);
            if (b.prefix) applyPrefix(b.prefix);
          }
        },
          b.fa
            ? R("i", { className: b.label, style: { fontSize: 16 } })
            : b.label
        );
      })
    );

    return R("div", { style: { display: "flex", flexDirection: "column", margin: "0 -28px" } },
      heroZone,
      R("div", { style: { width: "100%", padding: "32px 48px 0", boxSizing: "border-box", display: "flex", flexDirection: "column" } },
        R("input", {
          className: "comp-title-input",
          placeholder: "Article title\u2026",
          value: title,
          onChange: function (e) { setTitle(e.target.value); },
          autoFocus: !isEdit
        }),
        R("div", { className: "comp-meta-row" },
          R("select", {
            className: "comp-sel",
            value: categoryId,
            onChange: function (e) { setCategoryId(e.target.value); },
            style: { appearance: "none", paddingRight: 28, backgroundImage: "none" }
          },
            R("option", { value: "" }, "No category"),
            categories.map(function (c) {
              return R("option", { key: c.id, value: String(c.id) }, c.name);
            })
          ),
          R("div", { style: { fontSize: 12, color: "rgba(255,255,255,0.28)", display: "flex", alignItems: "center", gap: 5, padding: "5px 0" } },
            R("i", { className: "fa-solid fa-clock", style: { fontSize: 11 } }),
            mins + " min read"
          ),
          status === "published" && R("span", {
            className: "sp-tag",
            style: { color: "rgba(52,211,153,0.9)", borderColor: "rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.08)" }
          }, "Published")
        ),
        R("div", {
          style: {
            background: "var(--s1)", borderRadius: "0 0 12px 12px",
            display: "flex", flexDirection: "column"
          }
        },
          toolbar,
          R("textarea", {
            ref: taRef,
            className: "comp-ta",
            placeholder: "Write your article\u2026",
            value: body,
            onChange: function (e) { setBody(e.target.value); },
            style: { padding: "16px", minHeight: 560, resize: "vertical" }
          })
        ),
        R("div", { className: "comp-footer" },
          R("span", { className: "comp-char" }, body.length + " characters"),
          R("div", { style: { display: "flex", gap: 8, marginLeft: "auto" } },
            status === "published"
              ? R("button", {
                  className: "btn-ghost",
                  disabled: publishing,
                  onClick: unpublish
                }, publishing ? "Unpublishing\u2026" : "Unpublish")
              : null,
            canPublish && status !== "published"
              ? R("button", {
                  className: "btn-primary",
                  disabled: saving || publishing,
                  onClick: function () { setPublishing(true); save(true); }
                }, publishing ? "Publishing\u2026" : "Publish")
              : null,
            R("button", {
              className: status === "published" ? "btn-primary" : "btn-ghost",
              disabled: saving,
              onClick: function () { save(false); }
            }, saving ? "Saving\u2026" : (status === "published" ? "Save changes" : "Save draft"))
          )
        )
      )
    );
  }

  // ── Admin panel ────────────────────────────────────────────────────────────

  function BlogAdminPanel() {
    var [tab, setTab] = useState("articles");
    var R = window.React.createElement;

    var tabs = [
      { key: "articles",   label: "Articles",   icon: "fa-newspaper" },
      { key: "categories", label: "Categories", icon: "fa-tag" }
    ];

    return R("div", null,
      R("div", { className: "admin-tabs-underline" },
        tabs.map(function (t) {
          return R("button", {
            key: t.key,
            className: "admin-tab-underline" + (tab === t.key ? " active" : ""),
            onClick: function () { setTab(t.key); }
          },
            R("i", { className: "fa-solid " + t.icon }),
            " " + t.label
          );
        })
      ),
      tab === "articles"   && R(ArticlesTab, {
        navigate: function (url) { NE.navigate(url); }
      }),
      tab === "categories" && R(CategoriesTab, null)
    );
  }

  // ── Register surfaces ──────────────────────────────────────────────────────

  NE.registerAdminPanel(SLUG, {
    label: "Blog",
    icon:  "fa-newspaper",
    component: BlogAdminPanel
  });

  NE.registerExploreItem({
    slug:     SLUG,
    path:     "/",
    label:    "Blog",
    icon:     "fa-newspaper",
    priority: 50
  });

  NE.registerRoute(SLUG, "/compose",     BlogComposer, { title: "New article" });
  NE.registerRoute(SLUG, "/compose/:id", BlogComposer, { title: "Edit article" });

})();

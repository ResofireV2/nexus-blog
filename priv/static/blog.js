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

  // ── ColorPicker — matches FormHelpers.jsx exactly ─────────────────────────

  function ColorPicker({ value, onChange }) {
    var inputRef = useRef();
    var valid = isValidHex(value);
    return window.React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 10 } },
      window.React.createElement(
        "div",
        { style: { position: "relative", width: 36, height: 36, flexShrink: 0 } },
        window.React.createElement("div", {
          style: {
            width: 36, height: 36, borderRadius: 8,
            background: valid ? value : "rgba(255,255,255,0.1)",
            border: "0.5px solid var(--b2)", cursor: "pointer"
          },
          onClick: function () { inputRef.current && inputRef.current.click(); }
        }),
        window.React.createElement("input", {
          ref: inputRef,
          type: "color",
          value: valid ? value : DEFAULT_COLOR,
          onChange: function (e) { onChange(e.target.value); },
          style: { position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }
        })
      ),
      window.React.createElement("input", {
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
    return window.React.createElement(
      "span",
      {
        style: {
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 20,
          background: bg, color: color || "var(--t3)",
          border: "0.5px solid " + border
        }
      },
      icon && window.React.createElement("i", {
        className: "fa-solid " + icon,
        style: { fontSize: 9 }
      }),
      name
    );
  }

  // ── Category form (create or edit) ────────────────────────────────────────

  function CategoryForm({ initial, onSave, onCancel, saving }) {
    var isNew = !initial;
    var [form, setForm] = useState(initial || {
      name: "", slug: "", color: DEFAULT_COLOR, icon: DEFAULT_ICON
    });
    var [slugEdited, setSlugEdited] = useState(!isNew);

    function set(key, val) {
      setForm(function (p) { return Object.assign({}, p, { [key]: val }); });
    }

    function handleNameChange(e) {
      var name = e.target.value;
      set("name", name);
      if (!slugEdited) {
        set("slug", toSlug(name));
      }
    }

    var R = window.React.createElement;

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

      // Name + Slug row
      R("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 } },
        R("div", null,
          R("label", { className: "f-label" }, "Name"),
          R("input", {
            className: "fi",
            value: form.name,
            onChange: handleNameChange,
            placeholder: "e.g. Tutorials",
            style: { fontSize: 13, padding: "9px 13px" }
          })
        ),
        R("div", null,
          R("label", { className: "f-label" }, "Slug"),
          R("input", {
            className: "fi",
            value: form.slug,
            onChange: function (e) { setSlugEdited(true); set("slug", e.target.value); },
            placeholder: "auto-generated",
            style: { fontSize: 13, padding: "9px 13px", fontFamily: "monospace", color: "var(--t3)" }
          }),
          R("div", { className: "f-hint" }, "Used in URLs · auto-generated from name")
        )
      ),

      // Color
      R("div", { style: { marginBottom: 16 } },
        R("label", { className: "f-label" }, "Color"),
        R(ColorPicker, {
          value: form.color,
          onChange: function (v) { set("color", v); }
        }),
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

      // Icon — preview box + text input + grid (matches AdminPage.jsx Spaces pattern)
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
              background: "rgba(255,255,255,0.05)",
              border: "0.5px solid var(--b2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0
            }
          },
            R("i", {
              className: "fa-solid " + (form.icon || DEFAULT_ICON),
              style: { fontSize: 15, color: isValidHex(form.color) ? form.color : "var(--t3)" }
            })
          ),
          R("input", {
            className: "fi",
            value: form.icon || "",
            onChange: function (e) { set("icon", e.target.value); },
            placeholder: DEFAULT_ICON,
            style: { fontFamily: "monospace", fontSize: 12 }
          })
        ),
        R("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 } },
          CATEGORY_ICONS.map(function (ic) {
            return R("button", {
              key: ic,
              title: ic,
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

      // Preview
      R("div", { style: { marginBottom: 20 } },
        R("label", { className: "f-label" }, "Preview"),
        R(CategoryPreview, { name: form.name || "Category name", color: form.color, icon: form.icon }),
        R("div", { className: "f-hint", style: { marginTop: 8 } },
          "How the badge appears on article cards and filter pills"
        )
      ),

      // Actions
      R("div", { style: { display: "flex", gap: 8 } },
        R("button", {
          className: "btn-primary",
          style: { fontSize: 13, padding: "8px 20px" },
          disabled: saving || !form.name.trim() || !form.slug.trim(),
          onClick: function () { onSave(form); }
        }, saving ? "Saving…" : (isNew ? "Create category" : "Save changes")),
        R("button", {
          className: "btn-ghost",
          onClick: onCancel
        }, "Cancel")
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

    var load = useCallback(function () {
      apiGet("/categories").then(function (d) {
        setCategories(d.categories || []);
      }).catch(function () {
        setCategories([]);
      });
    }, []);

    useEffect(function () { load(); }, [load]);

    function handleSave(form) {
      setSaving(true);
      var isNew = !editing;
      var p = isNew
        ? apiPost("/categories", form)
        : apiPatch("/categories/" + editing.id, form);

      p.then(function (d) {
        if (d.error) {
          toast(d.error, "err");
        } else {
          toast(isNew ? "Category created." : "Category updated.");
          setShowForm(false);
          setEditing(null);
          load();
        }
      }).catch(function () {
        toast("Failed to save category.", "err");
      }).finally(function () {
        setSaving(false);
      });
    }

    function handleDelete(cat) {
      if (!window.confirm("Delete \"" + cat.name + "\"? Articles in this category will be uncategorised.")) return;
      setDeleting(cat.id);
      apiDelete("/categories/" + cat.id).then(function (d) {
        if (d.error) {
          toast(d.error, "err");
        } else {
          toast("Category deleted.");
          load();
        }
      }).catch(function () {
        toast("Failed to delete category.", "err");
      }).finally(function () {
        setDeleting(null);
      });
    }

    var R = window.React.createElement;

    if (categories === null) {
      return R("div", { style: { color: "var(--t4)", fontSize: 13, padding: "20px 0" } }, "Loading…");
    }

    return R("div", null,
      // Table of existing categories
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
                    R("span", {
                      style: {
                        width: 8, height: 8, borderRadius: "50%",
                        background: cat.color, flexShrink: 0, display: "inline-block"
                      }
                    }),
                    R("span", { style: { color: "var(--t1)", fontWeight: 500 } }, cat.name)
                  )
                ),
                R("td", null,
                  R("i", { className: "fa-solid " + cat.icon, style: { fontSize: 13, color: cat.color } })
                ),
                R("td", null,
                  R("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
                    R("div", {
                      style: {
                        width: 14, height: 14, borderRadius: "50%",
                        background: cat.color, flexShrink: 0
                      }
                    }),
                    R("span", { style: { fontSize: 12, fontFamily: "monospace", color: "var(--t4)" } },
                      cat.color
                    )
                  )
                ),
                R("td", null,
                  R("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                    R("button", {
                      className: "btn-ghost",
                      style: { fontSize: 12, padding: "5px 14px" },
                      onClick: function () {
                        setEditing(cat);
                        setShowForm(true);
                      }
                    }, "Edit"),
                    R("button", {
                      className: "btn-ghost",
                      disabled: deleting === cat.id,
                      style: {
                        fontSize: 12, padding: "5px 14px",
                        borderColor: "rgba(248,113,113,0.3)",
                        color: deleting === cat.id ? "var(--t4)" : "var(--red)"
                      },
                      onClick: function () { handleDelete(cat); }
                    }, deleting === cat.id ? "Deleting…" : "Delete")
                  )
                )
              );
            })
          )
        )
      ),

      // New / edit form
      (showForm || categories.length === 0) && !editing
        ? R(CategoryForm, {
            initial: null,
            onSave: handleSave,
            onCancel: function () { setShowForm(false); },
            saving: saving
          })
        : editing
          ? R(CategoryForm, {
              initial: editing,
              onSave: handleSave,
              onCancel: function () { setEditing(null); setShowForm(false); },
              saving: saving
            })
          : R("button", {
              className: "btn-ghost",
              style: { marginTop: 4 },
              onClick: function () { setEditing(null); setShowForm(true); }
            }, "+ New category")
    );
  }

  // ── Admin panel ────────────────────────────────────────────────────────────

  function BlogAdminPanel() {
    var [tab, setTab] = useState("categories");

    var R = window.React.createElement;

    var tabs = [
      { key: "categories", label: "Categories", icon: "fa-tag" }
      // Articles and Settings tabs added in Stage 2 and Stage 5
    ];

    return R("div", null,
      // Tab bar
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

})();

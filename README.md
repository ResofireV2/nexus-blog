# Blog

A full-featured community blog for Nexus. Supports categories with color and icon customisation, hero images, rich Markdown articles, draft/publish workflow, right sidebar widgets, and digest integration.

## Installation

Install via Admin → Extensions → Install from URL, or from the command line:

```bash
mix nexus.extension.install ./blog
```

## Usage

Once installed, **Blog** appears in the left sidebar Explore section. Admins manage the blog via **Admin → Blog**.

### Categories

Create and manage categories in **Admin → Blog → Categories**. Each category has:
- A name and URL slug
- A hex color (full color picker + preset swatches)
- A Font Awesome icon (text input + quick-pick grid)

### Articles

Write articles via the **Blog** explore entry. The composer supports:
- A full-width hero image upload
- H1 / H2 / H3 headings, bold, italic, links, code blocks, blockquotes, lists
- Inline image uploads
- Draft / Publish / Submit for review workflow

### Permissions

| Permission | Default | Controls |
|---|---|---|
| `can_view_blog` | everyone | Blog index and article reading |
| `can_write_articles` | admin | Open composer, save drafts |
| `can_publish_articles` | admin | Publish and unpublish articles |

Configure in **Admin → Permissions → Blog**.

## Settings

| Setting | Default | Description |
|---|---|---|
| Blog title | Blog | Page heading and explore sidebar label |

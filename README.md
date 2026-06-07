# Blog

A full-featured community blog for Nexus. Supports categories with color and icon customisation, hero images, rich Markdown articles, draft/publish workflow, right sidebar widgets, and digest integration.

## Installation

Install via **Admin → Extensions → Install from URL**, or from the command line:

```bash
mix nexus.extension.install ./blog
```

## Features

- **Full-bleed hero images** — article cards and the reading view use the hero image as a full background with a gradient overlay
- **Categories** — admin-defined categories with a custom color (full color picker + presets) and Font Awesome icon
- **Rich composer** — hero image upload, title, category selector, full Markdown toolbar with inline image uploads, draft/publish workflow
- **Blog index** — featured hero card for the latest article, 2-column grid for the rest, category filter pills
- **Article reading view** — full hero, title, author, date, reading time, rendered Markdown body
- **Right sidebar widgets** — "From the blog" on the feed (2 latest articles), "Recent articles" and "Categories" on blog pages
- **Digest integration** — "Latest from the blog" section in digest emails

## Usage

Once installed, **Blog** appears in the left sidebar Explore section. Click it to browse published articles.

Admins manage the blog via **Admin → Blog**:

- **Articles tab** — view all articles (published and draft), publish/unpublish, edit, delete
- **Categories tab** — create and manage categories with color and icon

### Writing articles

Click **+ Write article** from the blog index or Admin → Blog → Articles. The composer supports:

- A full-width hero image upload (click the zone or the Upload button)
- H1 / H2 / H3 headings, bold, italic, strikethrough, links, code blocks, blockquotes, dividers, lists
- Inline image uploads via the toolbar image button
- Save as draft or publish immediately

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
| Blog title | Blog | Page heading displayed on the blog index |

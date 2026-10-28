# Dave Stroup website and journal

The homepage and résumé remain ordinary HTML/CSS. Journal entries live in `posts/`; generated pages go into `_site/`. Node.js 24 LTS is recommended.

## First-time setup

From this website folder, install dependencies:

```sh
npm install
```

The repository also includes a pinned pnpm lockfile for reproducible GitHub builds. You can use `pnpm install --frozen-lockfile --ignore-scripts` instead if pnpm is installed.

## Create an entry

```sh
npm run new -- "A walk by the river"
```

This creates `posts/a-walk-by-the-river/index.md` with today's date in New York time and `draft: true`. An existing folder is never overwritten.

Edit that file in any text editor. Put pictures in the same folder:

```markdown
---
title: A walk by the river
date: 2026-10-28
draft: true
summary: "A few notes from this afternoon."
---

A paragraph with **bold**, *italics*, or [a link](https://example.com).

![Autumn trees beside the river](river.jpg)

*An optional caption.*
```

Use simple filenames with no spaces for pictures. Local images are automatically oriented, resized to several widths (up to 1600 pixels), converted to WebP, and given responsive markup. Originals stay in the source folder; the deployed site includes the optimized copies. Include descriptive alt text. External image URLs are displayed as supplied and are not optimized. Images in Markdown links should be local image references as shown above, not raw HTML.

`summary` is optional; without it the index uses the first text paragraph. Folder names become permanent URLs, so avoid renaming a published entry folder.

## Preview

```sh
npm run preview
```

Open http://127.0.0.1:4188/journal/. Drafts appear with a label. Saving entries, images, or journal styling rebuilds the preview and reloads the page. Stop with Ctrl+C. A broken entry prints an error in the terminal; fix it and save again. Restart preview after editing the build script.

## Publish

1. Review the entry locally.
2. Change `draft: true` to `draft: false`.
3. Run `npm test` and `npm run build`.
4. Commit and push your source changes to GitHub's `main` branch. The included workflow builds and deploys the whole website, including `/journal/` and `/journal/feed.xml`.

One-time GitHub setup: in repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. The workflow must be on `main`. Review its first successful run in the Actions tab before considering publishing configured. Until these steps are completed, this local checkout has no automatic deployment.

The sample entries are drafts and do not appear in production. An empty journal displays a simple placeholder until you publish your first entry. RSS contains published entries only, even during preview. Build output is always regenerated, so unpublishing an entry also removes its previously generated files.

**Drafts are not private storage.** This is a public GitHub repository: anything you commit, including draft Markdown and original photos, can be read on GitHub. Keep sensitive writing outside this repository until ready to share. Image metadata may also remain in original files committed to GitHub; generated WebP copies omit metadata.

Only the existing homepage, stylesheet, CNAME and résumé folder plus generated journal pages are copied into the deployed output. Build scripts, Markdown source and original photos are not included in that output. The homepage Journal link is added in this checkout as part of integration.

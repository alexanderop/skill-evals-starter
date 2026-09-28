---
title: Develop and publish the docs
description: Build this Starlight site locally or publish a fork with GitHub Pages.
---

## Preview a change

Edit Markdown or MDX under `docs/src/content/docs/`. Set a page title and description in frontmatter. Add new pages to the sidebar in `docs/astro.config.mjs`.

```sh
pnpm docs:dev
```

Open the URL printed by Astro with the configured base path. To check the production search index and static links:

```sh
pnpm docs:build
pnpm docs:preview
```

## Configure a fork

Update `site` and `base` defaults in `docs/astro.config.mjs`, or set `DOCS_SITE` and `DOCS_BASE` during the build. Set the origin to your Pages origin and the base to your repository path. For an account-root site, use `/`.

Update the GitHub social link and edit-link URL to your repository. Update documentation links in the README.

## Enable GitHub Pages

In repository settings, select **Pages**, then **GitHub Actions** as the build source. The CI workflow builds and checks the docs on pull requests and pushes to `main`. Only a push to `main` deploys the verified artifact to the `github-pages` environment.

The workflow needs `pages: write` and `id-token: write` only for its deployment job. It does not authenticate an agent or call a model.

## Verify publication

Open the deployed site from the Actions deployment URL. Follow a guide link, search for a documented term, and open a result. Check a narrow viewport and the navigation menu. A successful static build alone does not prove that the deployed base path or search assets work.

Configuration follows the official [Starlight setup](https://starlight.astro.build/manual-setup/) and [Astro GitHub Pages deployment](https://docs.astro.build/en/guides/deploy/github/) guides.

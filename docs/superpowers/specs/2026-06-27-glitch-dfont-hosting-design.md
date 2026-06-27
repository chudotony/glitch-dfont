# Glitch.dfont Hosting And Repository Design

## Purpose

Turn the current coursework repository into a public project repository for `Glitch.dfont`, a browser-based `.dfont` glitching app. The hosted app should be free or very cheap to run, easy to share, and usable by visitors without installing FontForge.

## Current Context

The repository currently contains:

- A static web app in `app/` with `index.html`, `app.js`, and `font-core.js`.
- `.dfont`, `.ttf`, `.woff2`, PostScript, bitmap, UFO, notebook, generated image, and course-process material.
- A short coursework README: "Experiments with corrupting files for Digital Culture class".
- A remote named `origin` pointing to `https://github.com/chudotony/hgk_glitch_26.git`.

The whole working tree is small enough for free static hosting. The app runs entirely in the browser, so hosting does not need FontForge, a server runtime, or a database.

## Decision

Keep the existing repository and history, but rename and reorganize it as a public project repository.

Repository name:

```text
glitch-dfont
```

Public app identity:

```text
Glitch.dfont
```

Expected GitHub Pages URL:

```text
https://chudotony.github.io/glitch-dfont/
```

## Hosting Choice

Use GitHub Pages as the first hosting target.

Reasons:

- The app is static HTML, CSS, and JavaScript.
- GitHub Pages is free for public repositories.
- It keeps the project repository and hosted app connected.
- Current app and sample-file sizes are well below GitHub Pages limits.
- It avoids adding another hosting account or deployment dashboard.

Cloudflare Pages is a good fallback if the project later needs broader deployment controls, more generous static asset handling, or a custom workflow outside GitHub Pages. Vercel and Netlify are viable, but they do not add meaningful value for this static app at the current scale.

## Repository Structure

Target structure:

```text
/
  README.md
  docs/
    index.html
    app.js
    font-core.js
    samples/
      *.dfont
  research/
    bitmap/
    postscript/
    woff2/
    dfont_rendering/
    Utopia-Regular_8_images/
  docs/superpowers/
    specs/
    plans/
```

Notes:

- `docs/` is the GitHub Pages publishing source.
- `docs/samples/` contains only curated `.dfont` files that are useful for trying the app.
- `research/` keeps the course/archive/process material visible but secondary.
- The root README becomes project-facing and links to the live app.

## Sample Files

Include a small curated set of `.dfont` samples in the hosted app so visitors can try the tool without installing FontForge or preparing a file.

The app should still support:

- Uploading local `.dfont` files.
- Dragging and dropping `.dfont` files.
- Downloading the glitched result.

The hosted samples are convenience assets, not a replacement for user-uploaded files.

## Public README

Rewrite the root README around the project:

- What `Glitch.dfont` does.
- Link to the hosted app.
- What `.dfont` files work best.
- How to use the included samples.
- What runs locally in the browser.
- Short research/archive note explaining that the repo began as coursework.
- License/credit notes for bundled fonts and samples.

## GitHub Pages Setup

Use GitHub Pages from the `docs/` folder on the default branch.

After repository rename, configure:

- Repository: `chudotony/glitch-dfont`
- Pages source: default branch, `/docs`
- App URL: `https://chudotony.github.io/glitch-dfont/`

If a custom domain is added later, it can be configured after the GitHub Pages deployment works.

## Risks And Constraints

### Project Site URL Changes

GitHub redirects most renamed repository links, but project site URLs are not guaranteed to redirect the same way. Rename the repository before publishing the GitHub Pages URL publicly.

### Font Licensing

Only include sample font files that are allowed to be redistributed publicly. If any sample's redistribution rights are uncertain, keep it in `research/` or remove it from the public `docs/samples/` set.

### Path Assumptions

Because GitHub Pages project sites are served from `/glitch-dfont/`, the app should use relative paths for local assets. Avoid root-relative paths such as `/samples/file.dfont`.

### User Changes

The working tree currently has local changes in `app/index.html`. Future implementation should inspect and preserve those changes instead of overwriting them.

## Alternatives Considered

### New Clean Repository

This would create the cleanest public presentation but would split the project from its research/process history. It is unnecessary unless old commits contain private, copyrighted, or confusing material that should not remain public.

### Keep Current Repository Name

This avoids a GitHub rename step, but `hgk_glitch_26` reads like coursework and is weaker as a public project identity.

### Cloudflare Pages First

Cloudflare Pages is strong static hosting, but it adds another platform. GitHub Pages is simpler and sufficient for the current app.

## Implementation Scope

The implementation plan should cover:

1. Rename repository on GitHub to `glitch-dfont`.
2. Update local `origin` remote after rename.
3. Move the static app into `docs/`.
4. Add curated samples under `docs/samples/`.
5. Move course/process material under `research/`.
6. Rewrite the root README.
7. Ensure relative asset paths work from a GitHub Pages project URL.
8. Configure GitHub Pages from `/docs`.
9. Verify the app locally and through the Pages URL.


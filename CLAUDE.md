# Working on this repository

Context for Claude Code (or any agent) picking this project up fresh.

## What this is

The website for **Kat &amp; Co.**, a pet sitting business in Vancouver, BC
(boarding, day care, drop-in visits, dog walking), owned by Alejandra. Maintained
by Miguel Monzones.

Deployed via **GitHub Pages** at <https://katty-co.github.io>. Because the repo is
named `Katty-Co.github.io`, it is the `Katty-Co` org's root Pages site and
publishes automatically from `main` — there is no Actions workflow and no build
step. Push to `main` and it goes live within a minute or two.

## Read this before editing anything

### 1. `index.html` is a bundle. Do not hand-edit it.

It is a ~9.2 MB **self-contained build artifact**. Every image, font, plus React,
ReactDOM and the application code are embedded in a compressed payload that a
small loader unpacks at runtime (you will see an "Unpacking..." indicator on first
paint). The page makes **zero external network requests** and works offline. The
`unpkg.com` URLs inside it are asset-manifest identifiers, not live CDN fetches.

The markup and styles are not addressable as text. Searching for a heading or a
CSS rule will fail, and any edit that appears to work will corrupt the payload.

**To change the site:** edit the original source project, re-export the standalone
build, and overwrite `index.html` wholesale. Then commit the new bundle.

The most recent raw export is kept beside the repo as `Kat & Co (standalone).html`
(untracked); `index.html` is a copy of it, renamed because Pages requires that
filename and the original contains spaces, an ampersand and parentheses.

**The static head is not a patch point either.** The top of the file looks like
ordinary editable HTML — `<!DOCTYPE html>`, `<html>`, a `<head>` with styles and
the loader `<script>`. It is not a useful place to fix anything: the loader calls
`replaceWith` on the document root once unpacking finishes, so the original
`<html>` element and its attributes are discarded. Adding `lang="en"` there, for
example, changes the file but has zero effect at runtime — verified. Document-level
fixes must come from the source project.

Corollary: the app injects its own `<meta name="viewport">` at runtime, so grepping
the static head for one gives a false negative. Check the live DOM, not the file.

### 2. `.gitignore` is a whitelist. Keep it that way.

The working folder also holds roughly **2.6 GB of raw source photography and
video** — `Dogs/` (~1.1 GB), `Cats/` (~187 MB), `Photos-1-001/`, and a 1.3 GB
`Photos-1-001.zip`. None of it belongs in git; the zip alone exceeds GitHub's hard
100 MB per-file limit and would be rejected.

So `.gitignore` ignores everything (`/*`) and opts individual paths back in. When
adding a genuinely new tracked file, add a matching `!` entry. Do not replace this
with a conventional denylist — a single careless `git add -A` would otherwise try
to commit gigabytes irrecoverably into history.

Always confirm what you are about to commit:

```bash
git diff --cached --name-only
```

### 3. `.gitattributes` protects the bundle from line-ending conversion.

This project is developed on Windows with `core.autocrlf=true`. Left unguarded,
Git would rewrite LF to CRLF inside `index.html` and corrupt its base64 payload,
so the bundle would fail to unpack for anyone cloning the repo.

`index.html` is therefore pinned with `-text`. Do not remove that rule. After
replacing the bundle, verify the stored blob is byte-identical to the file on disk:

```bash
sha256sum index.html
git cat-file -p :index.html | sha256sum
```

Both hashes must match. If they differ, `.gitattributes` is not doing its job.

### 4. `.nojekyll` must stay.

It stops GitHub Pages running the files through Jekyll, which has no business
touching a prebuilt single-file site.

### 5. Commit identity

Commit as the owner's personal GitHub identity, `miguelmonzones@gmail.com` — the
address verified on the account, so commits link to the right profile. Do **not**
author commits here with any employer or work email address; this project is
deliberately kept separate from the owner's professional and other personal
namespaces. A global git identity is configured, so the default is correct; just
don't override it in this repo.

### 6. Known issue: the export ships un-compiled interaction directives

The current bundle renders only the landing view. Everything behind the nav —
**The Pack, Reviews, FAQ and the booking enquiry form** — exists in the payload
but never mounts, so `document.forms` is empty and every nav link is inert.

The cause is in the export, not in this repo. Interaction is serialized as
declarative placeholders that nothing ever binds:

```html
<a href="#" sc-camel-on-click="{{ goPets }}" style-hover="background:#F4795B;">The Pack</a>
```

Measured in the bundle: 38 `sc-camel-on-click`, 8 `sc-camel-on-input`,
2 `sc-camel-on-submit`, 1 `sc-camel-on-change`, 28 `style-hover`, and 107
unresolved `{{ binding }}` expressions — against **zero** compiled `onClick` or
`onSubmit` props, and **zero** references to `sc-camel` or `{{` anywhere in the
loader code. There is no runtime present that could attach them.

Affected handlers: `goHome` `goServices` `goAbout` `goPets` `goReviews` `goFaq`
`goContact` (navigation), `toggleMenu` / `menuOpen` (mobile menu), `showPrices`,
`showCrew`, `submit` (booking form), `submitReview` (review form).

Do not try to patch this in `index.html` — it is generated, and the payload is
not safely editable. It has to be fixed where the bundle is produced, by
exporting a **built application** rather than a design-time serialization.

Guard before deploying any new bundle:

```bash
grep -o 'sc-camel-on-[a-z]*' index.html | wc -l   # want 0
grep -o -E '\{\{ *[a-zA-Z][A-Za-z0-9_]* *\}\}' index.html | wc -l   # want 0
```

Non-zero means the interactive layer will be dead again. A useful smoke test is
that `document.forms.length` should be greater than 0 once the export is correct.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | The entire site. Self-contained bundle. Generated, not edited. |
| `brand/` | Brand and identity sources — logo, icon, mascot, Affinity `.af` document. Not referenced by the site at runtime; the assets it uses are embedded. |
| `.nojekyll` | Disables Jekyll on Pages. |
| `.gitattributes` | Protects the bundle from CRLF conversion. |
| `.gitignore` | Whitelist guarding against the untracked media. |

## Running it locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python -m http.server 8765
```

## Verifying a change

Rendering matters more than a diff here, since the diff of a rebuilt bundle is
meaningless noise. After replacing `index.html`:

1. Confirm the two sha256 hashes match (see §3).
2. Run the un-compiled-directive guard in §6. Both counts must be zero.
3. Load the page and confirm it renders past the "Unpacking..." stage.
4. Confirm the console is clean, `document.forms.length > 0`, and that the nav
   links actually navigate. Hard-reload or cache-bust — a stale bundle will
   otherwise appear to work when it has not changed.
5. Spot-check accessibility in the live DOM (not the file): `document.documentElement.lang`
   should be set, `document.images` should all have `alt`, and
   `document.documentElement.scrollWidth` must not exceed `window.innerWidth` at a
   375px viewport. As of the last check: alt text complete on all 18 images and no
   horizontal overflow, but `lang` is unset and can only be fixed upstream.
6. After pushing, confirm the live `Content-Length` matches the local byte count:

```bash
stat -c%s index.html
curl -sI "https://katty-co.github.io/?cb=$RANDOM" | grep -i content-length
```

Pages serves with `Cache-Control: max-age=600`, so a fresh deploy can take a few
minutes to appear and a plain reload may show the previous bundle. Always append a
cache-busting query string when verifying, and hard-reload in the browser.

## Site structure

Intended as a single page with anchored sections: hero, about Alejandra, four
service tiers with pricing, a profile of Kat (the resident cat), client
testimonials sourced from Rover, the household pet roster, an FAQ, and a booking
enquiry form.

**What currently renders** is the hero, about, the four service tiers, the Kat
profile, testimonials and the stats band — ending at "What owners say when they
get home". The remaining sections are present in the payload but do not mount;
see §6. Bookings therefore happen through Alejandra directly or via her Rover
profile, not through the on-page form.

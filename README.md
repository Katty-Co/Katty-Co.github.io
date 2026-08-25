# Katty &amp; Co. — Pet Sitting in Vancouver, BC

Marketing site for **Katty &amp; Co.**, the small-group pet boarding, day care,
drop-in visit and dog walking service run by Alejandra in Vancouver, British
Columbia.

**Live site:** https://katty-co.github.io

## Pages

| URL | What it is |
| --- | --- |
| `/` | Hero, the four services, a profile of Kat, recent reviews |
| `/services/` | The four service tiers with full rates |
| `/about/` | Alejandra — experience, credentials, the household |
| `/pack/` | The regulars: 13 flip cards of dogs and cats |
| `/reviews/` | 21 testimonials, plus a form to leave one |
| `/faq/` | Ten common questions |
| `/booking/` | Enquiry form — service, dates, pets, contact details |

## What's here

| Path | What it is |
| --- | --- |
| `index.html` + one folder per page | The built site. Plain static HTML. Generated. |
| `assets/site.js` | The only JavaScript — ~6 KB, hand-written, no dependencies |
| `img/` | The 19 photographs used across the pages |
| `brand/` | Brand and identity source files |
| `tools/` | The compiler that builds the pages from the design source |

## Architecture

Static HTML, served straight from GitHub Pages. There is no framework, no
bundler and no build step on deploy — push to `main` and it is live.

Each page is self-contained HTML with inlined styles, plus one shared 6 KB
script that handles the mobile menu, the flip cards, the form chips and form
submission. The only third-party request on the page is Google Fonts, which
degrades to a system font stack if it is unavailable.

The pages are **generated**, not hand-written. They are compiled from Claude
Design canvas sources (`.dc.html`) that live outside this repository; `tools/build.js`
prerenders them, freezes the result to static HTML, rewrites the links to clean
URLs and wires the forms. See [CLAUDE.md](CLAUDE.md) for the full process — and
read it before editing anything, since edits to a generated page will be lost on
the next build.

### Why not the previous single-file bundle

This site previously shipped as one 9.2 MB self-contained `index.html`. That
export serialised its interaction layer without ever compiling it, so the nav
links, the mobile menu and both forms were inert — only the landing view
rendered, and the other six pages, though present in the payload, could not be
reached. The current build replaces it with seven real pages at real URLs and is
about half the size.

## Running it locally

Use a server that maps `/services/` to `/services/index.html`:

```bash
python3 -m http.server 8766
```

Then visit http://localhost:8766.

## Source media

The raw photography this site was built from — several gigabytes of original
photos and video — is deliberately **not** tracked here. `.gitignore` uses a
whitelist strategy so that only the paths listed above can ever be staged.

## Booking

The booking form emails Alejandra directly. Enquiries also go to her
[Rover profile](https://www.rover.com/members/alejandra-f-experienced-sitter-for-dogs-cats/).

# Kat &amp; Co. — Pet Sitting in Vancouver, BC

Marketing site for **Kat &amp; Co.**, the small-group pet boarding, day care,
drop-in visit and dog walking service run by Alejandra in Vancouver, British
Columbia.

**Live site:** https://katty-co.github.io

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The entire website. A single self-contained bundle. |
| `brand/` | Brand and identity source files (logo, icon, mascot, Affinity document). |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is, without Jekyll processing. |

## The single-file architecture

`index.html` is a **fully self-contained bundle**. Every asset the site needs —
images, fonts, React and ReactDOM, and the application code — is embedded in the
file and unpacked by a small loader at runtime. You will briefly see an
"Unpacking..." indicator on first paint while that happens.

Practical consequences:

- **No build step.** There is nothing to compile, install, or bundle.
- **No dependencies.** The page makes zero external network requests and renders
  offline. The `unpkg.com` URLs inside the file are asset-manifest identifiers,
  not live CDN fetches.
- **No server required.** Opening the file directly from disk works.
- **It is not hand-editable.** The markup and styles live inside a compressed
  payload. Meaningful changes are made in the original source project and a new
  bundle is exported over this file.

The file is roughly 9 MB, which is expected — it carries all of its own media.

## Running it locally

Open `index.html` in any modern browser, or serve the folder:

```bash
python -m http.server 8765
```

Then visit http://localhost:8765.

## Site contents

Single-page layout: hero, about Alejandra, the four service tiers with pricing, a
profile of Kat (resident cat and nominal Head of Hospitality), client testimonials
sourced from Rover, and a stats band.

Further sections — the household pet roster, an FAQ and a booking enquiry form —
are present in the bundle but are not currently reachable, because the export
serializes their nav handlers without compiling them. See `CLAUDE.md` §6.
Enquiries go to Alejandra directly or through her Rover profile in the meantime.

## Source media

The raw photography this site was built from — several gigabytes of original
photos and video — is deliberately **not** tracked in this repository. It lives
outside version control. `.gitignore` uses a whitelist strategy so that only the
files listed above can ever be staged.

## Booking

Bookings go through Alejandra directly, or via her
[Rover profile](https://www.rover.com/members/alejandra-f-experienced-sitter-for-dog).

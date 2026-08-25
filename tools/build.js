/* Static compiler for Katty & Co.
   Usage: npm i && node build.js      (from this tools/ directory)
   Env  : KATCO_SRC = canvas sources, KATCO_OUT = output root
   Input also needs tools/captured/*.html — see CLAUDE.md section 2.
   Input : captured/*.html  (pages prerendered through the real dc-runtime)
   Output: dist/            (plain static site, no React, no CDN, clean URLs)
*/
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CAP = path.join(__dirname, 'captured');
const OUT = process.env.KATCO_OUT || path.resolve(__dirname, '..');
const SRC = process.env.KATCO_SRC || path.resolve(__dirname, '../../Website Pages');
const FORMSPREE = 'https://formspree.io/f/xjybqoar';
// The site is served at the custom domain; katty-co.github.io 301s here.
// Canonical/OG/sitemap URLs must name the domain we actually promote.
const ORIGIN = process.env.KATCO_ORIGIN || 'https://kattyco.ca';

const PAGES = [
  { key: 'index',    route: '',         nav: 'home',
    desc: 'Small-group pet boarding, doggy day care, drop-in visits and dog walking in Vancouver, BC. Star Sitter on Rover, background checked, photo updates on every booking.' },
  { key: 'services', route: 'services', nav: 'services',
    desc: 'Rates for boarding, doggy day care, drop-in visits and dog walking in Vancouver, BC. Clear per-night and per-visit pricing with no hidden fees.' },
  { key: 'about',    route: 'about',    nav: 'about',
    desc: 'Meet Alejandra — 24 years with animals, former cat foster, Star Sitter on Rover, background checked and home all day in Vancouver, BC.' },
  { key: 'pack',     route: 'pack',     nav: 'pack',
    desc: 'Meet the dogs and cats who stay with Katty & Co. in Vancouver, BC — the regulars, the puppies and the seniors.' },
  { key: 'reviews',  route: 'reviews',  nav: 'reviews',
    desc: 'What owners say after picking their pets up — verified reviews from Rover for boarding, day care, drop-ins and walks in Vancouver, BC.' },
  { key: 'faq',      route: 'faq',      nav: 'faq',
    desc: 'Common questions about boarding, medication, reactive dogs, meet & greets, updates and how booking and payment work.' },
  { key: 'booking',  route: 'booking',  nav: null,
    desc: 'Ask about dates for boarding, day care, drop-in visits or dog walking in Vancouver, BC. Free meet & greet before the first booking.' },
];

const ROUTE_OF = { 'index.dc.html': '/', 'services.dc.html': '/services/', 'about.dc.html': '/about/',
  'pack.dc.html': '/pack/', 'reviews.dc.html': '/reviews/', 'faq.dc.html': '/faq/', 'booking.dc.html': '/booking/' };

const load = f => cheerio.load(fs.readFileSync(path.join(CAP, f + '.html'), 'utf8'), { decodeEntities: false });

/* ---------- hover/active CSS extraction (for markup lifted from source) ---------- */
let hoverCss = [];
function extractStateStyles($, scope) {
  scope.find('[style-hover],[style-active]').addBack('[style-hover],[style-active]').each((i, el) => {
    const $el = $(el);
    for (const [attr, pseudo] of [['style-hover', 'hover'], ['style-active', 'active']]) {
      const v = $el.attr(attr);
      if (!v) continue;
      const cls = 'kcs' + hoverCss.length;
      hoverCss.push('.' + cls + ':' + pseudo + '{' + v.split(';').filter(Boolean)
        .map(d => d.trim() + ' !important').join(';') + '}');
      $el.addClass(cls);
      $el.removeAttr(attr);
    }
  });
}

/* ---------- build one canonical responsive header from SiteHeader source ---------- */
function buildHeader() {
  const $ = cheerio.load(fs.readFileSync(path.join(SRC, 'SiteHeader.dc.html'), 'utf8'), { decodeEntities: false });
  const header = $('x-dc > header');
  const inner = header.children('div').first();

  const brand = inner.children('a').first();
  const desktopIf = inner.children('sc-if').filter((i, e) => ($(e).attr('value') || '').includes('isDesktopNav'));
  const mobileIf  = inner.children('sc-if').filter((i, e) => ($(e).attr('value') || '').includes('isMobileNav'));
  const menuIf    = header.children('sc-if').filter((i, e) => ($(e).attr('value') || '').includes('menuOpen'));

  extractStateStyles($, header);

  const desktopParts = desktopIf.children().map((i, e) => { $(e).addClass('kc-desktop'); return $.html(e); }).get().join('\n');
  const mobileParts  = mobileIf.children().map((i, e)  => { $(e).addClass('kc-mobile');  return $.html(e); }).get().join('\n');

  const menuNav = menuIf.children().first();
  menuNav.addClass('kc-menu').attr('id', 'kc-menu').attr('hidden', 'hidden');
  const menuHtml = $.html(menuNav);

  // tag the hamburger so site.js can bind it
  const mobileWrap = cheerio.load('<div>' + mobileParts + '</div>', { decodeEntities: false });
  mobileWrap('button').attr('data-menu-btn', '').attr('aria-controls', 'kc-menu').attr('aria-expanded', 'false')
    .removeAttr('onClick').removeAttr('onclick');
  // any other un-compiled template directive lifted from source must not survive
  mobileWrap('*').each((i, e) => {
    for (const a of Object.keys(mobileWrap(e).attr() || {})) {
      if (/\{\{/.test(mobileWrap(e).attr(a) || '')) mobileWrap(e).removeAttr(a);
    }
  });
  const mobileFixed = mobileWrap('div').first().html();

  return '<header style="' + header.attr('style') + '">\n' +
    '<div style="' + inner.attr('style') + '">\n' +
    $.html(brand) + '\n' + desktopParts + '\n' + mobileFixed + '\n' +
    '</div>\n' + menuHtml + '\n</header>';
}

/* ---------- shared CSS + rewriting helpers ---------- */
const HEADER_CSS = `
@media (max-width:880px){ .kc-desktop{display:none!important} }
@media (min-width:881px){ .kc-mobile{display:none!important} .kc-menu{display:none!important} }
.kc-menu[hidden]{display:none!important}
:focus-visible{outline:3px solid #C9503A;outline-offset:2px}
.kc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
[data-sent-panel][hidden]{display:none!important}
[data-pet-block][hidden],[data-crew-block][hidden],[data-cap-note][hidden]{display:none!important}
`;

function rewriteLinks($) {
  $('a[href]').each((i, el) => {
    const h = $(el).attr('href');
    if (ROUTE_OF[h]) $(el).attr('href', ROUTE_OF[h]);
  });
}
// canvas exports drop raw camera files at the source root; give them a real home
const ASSET_RENAME = { 'img_8711-mt2otwbv-zvzz.jpg': 'img/kat-resident.jpg' };

/* Read the EXIF orientation tag (0x0112), or null if the file carries no EXIF.
   Phone photos are stored unrotated with a flag telling the viewer how to turn
   them. That flag lives in the very EXIF block we strip for privacy, so the
   rotation has to be baked into the pixels first — otherwise the picture ships
   sideways. */
function exifOrientation(file) {
  const b = fs.readFileSync(file);
  if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
  let i = 2;
  while (i < b.length - 1) {
    if (b[i] !== 0xFF) break;
    const m = b[i + 1];
    if (m === 0xDA) break;
    if (m === 0xD8 || m === 0xD9 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (m === 0xE1 && b.toString('ascii', i + 4, i + 10) === 'Exif\0\0') {
      const t = i + 10;
      const le = b.toString('ascii', t, t + 2) === 'II';
      const u16 = o => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
      const u32 = o => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
      const ifd = t + u32(t + 4);
      const n = u16(ifd);
      for (let e = 0; e < n; e++) {
        const off = ifd + 2 + e * 12;
        if (u16(off) === 0x0112) return u16(off + 8);
      }
      return 1;
    }
    i += 2 + len;
  }
  return null;
}
const ROTATION_FOR = { 3: 180, 6: 90, 8: 270 };

/* Strip identifying metadata from a JPEG: APP1 (EXIF/XMP), APP13 (IPTC) and COM.
   These photos are taken at Alejandra's home; straight off an iPhone they carry
   GPS coordinates, which would publish her home address on a public website.
   Deliberately KEEPS APP0 (JFIF), APP2 (ICC colour profile) and APP14 (Adobe) —
   dropping those can shift the rendered colours. */
function stripJpegMetadata(file) {
  const b = fs.readFileSync(file);
  if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return false;   // not a JPEG
  const out = [b.subarray(0, 2)];
  let i = 2, removed = 0;
  while (i < b.length - 1) {
    if (b[i] !== 0xFF) break;
    const marker = b[i + 1];
    if (marker === 0xDA) { out.push(b.subarray(i)); i = b.length; break; }  // SOS: rest is image data
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) { out.push(b.subarray(i, i + 2)); i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    const drop = marker === 0xE1 || marker === 0xED || marker === 0xFE;     // APP1 (EXIF/XMP), APP13 (IPTC), COM
    if (drop) removed++; else out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (!removed) return false;
  fs.writeFileSync(file, Buffer.concat(out));
  return true;
}

function rewriteAssets($) {
  $('[src]').each((i, el) => {
    let s = $(el).attr('src');
    if (!s || /^(https?:|data:|\/|#)/.test(s)) return;
    s = s.replace(/^\.\//, '');
    if (ASSET_RENAME[s]) s = ASSET_RENAME[s];
    $(el).attr('src', '/' + s);
  });
  $('link[href]').each((i, el) => {
    const h = $(el).attr('href');
    if (h && !/^(https?:|data:|\/|#)/.test(h)) $(el).attr('href', '/' + h.replace(/^\.\//, ''));
  });
}
function stripDcAttrs($) {
  $('[data-dc-tpl]').removeAttr('data-dc-tpl');
  $('[data-sc-name]').removeAttr('data-sc-name');
}

function addMeta($, page) {
  const head = $('head');
  const canonical = ORIGIN + '/' + (page.route ? page.route + '/' : '');
  const title = ($('title').text() || 'Katty & Co.').trim();
  head.find('meta[name="description"],link[rel="canonical"],meta[property^="og:"],meta[name^="twitter:"]').remove();
  head.append(
    '\n<meta name="description" content="' + page.desc.replace(/"/g, '&quot;') + '">' +
    '\n<link rel="canonical" href="' + canonical + '">' +
    '\n<meta property="og:type" content="website">' +
    '\n<meta property="og:site_name" content="Katty &amp; Co.">' +
    '\n<meta property="og:title" content="' + title.replace(/"/g, '&quot;') + '">' +
    '\n<meta property="og:description" content="' + page.desc.replace(/"/g, '&quot;') + '">' +
    '\n<meta property="og:url" content="' + canonical + '">' +
    '\n<meta property="og:image" content="' + ORIGIN + '/img/hero-a.jpg">' +
    '\n<meta name="twitter:card" content="summary_large_image">' +
    '\n<meta name="theme-color" content="#FFF4E4">' +
    '\n<link rel="icon" href="/img/kat-logo.png" type="image/png">' +
    '\n<link rel="apple-touch-icon" href="/img/kat-logo.png">'
  );
}

/* ---------- form helpers ---------- */
function formShell($, form, subject) {
  form.attr('action', FORMSPREE).attr('method', 'POST').attr('novalidate', '');
  form.prepend('<input type="hidden" name="_subject" value="' + subject + '">' +
    '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" class="kc-sr">');
}
const FIELD_WRAP = 'display:grid; gap:7px; min-width:0;';
const LABEL_CSS  = 'font-family:\'Baloo 2\',cursive; font-weight:800; font-size:15px; color:#2B1D18;';
const INPUT_CSS  = 'width:100%; padding:12px 14px; border:3px solid #2B1D18; border-radius:14px; background:#FFF4E4; font-size:16px; color:#2B1D18; font-family:inherit;';
function field(name, label, type, ph, required) {
  const tag = type === 'textarea'
    ? '<textarea name="' + name + '" id="f-' + name + '" rows="3" placeholder="' + ph + '" style="' + INPUT_CSS + ' resize:vertical;"' + (required ? ' required' : '') + '></textarea>'
    : '<input type="' + type + '" name="' + name + '" id="f-' + name + '" placeholder="' + ph + '" style="' + INPUT_CSS + '"' + (required ? ' required' : '') + '>';
  return '<div style="' + FIELD_WRAP + '"><label for="f-' + name + '" style="' + LABEL_CSS + '">' + label + '</label>' + tag + '</div>';
}

/* ---------- per-page transforms ---------- */
function doIndex($) {
  // tag the googly eyes (runtime used callback refs, which leave no trace in the DOM)
  const pupils = $('span[style*="will-change"]');
  if (pupils.length === 2) {
    $(pupils[0]).attr('data-pupil', 'l');
    $(pupils[1]).attr('data-pupil', 'r');
    const eyes = $(pupils[0]).closest('[style*="pointer-events: none"]');
    if (eyes.length) eyes.attr('data-eyes', '');
  }
  return pupils.length;
}

function doPack($) {
  // drop the 13 hidden preload images (a runtime hack, useless once static)
  const pre = $('img[data-pet]').first().parent();
  if (pre.length) pre.remove();
  // tag flip cards
  $('[style*="perspective"]').each((i, el) => {
    const inner = $(el).children().first();
    inner.attr('data-flip', '').attr('tabindex', '0').attr('role', 'button').attr('aria-pressed', 'false');
    const name = inner.find('h3').first().text().trim();
    if (name) inner.attr('aria-label', 'Flip card for ' + name);
  });
}

function doReviews($) {
  const form = $('form').first();
  formShell($, form, 'New review from the Katty & Co. website');
  // stars
  $('button').filter((i, e) => /^[★☆]$/.test($(e).text().trim())).each((i, el) => {
    $(el).attr('data-star', String(i + 1)).attr('type', 'button')
         .attr('aria-label', (i + 1) + ' star' + (i ? 's' : ''));
  });
  form.prepend('<input type="hidden" name="rating" id="f-rating" value="5">');
  // service chips
  $('button').filter((i, e) => ['Boarding', 'Day care', 'Drop-ins', 'Walks'].includes($(e).text().trim()))
    .each((i, el) => $(el).attr('data-chip', 'service').attr('data-val', $(el).text().trim()).attr('type', 'button'));
  form.prepend('<input type="hidden" name="service" id="f-service" value="Boarding">');
  // name the visible fields
  const ins = form.find('input[placeholder], textarea');
  ins.each((i, el) => {
    const ph = ($(el).attr('placeholder') || '');
    if (/Gabrielly/.test(ph)) $(el).attr('name', 'name').attr('required', '').attr('id', 'f-name');
    else if (/Nacho/.test(ph)) $(el).attr('name', 'pet').attr('id', 'f-pet');
    else if (el.tagName === 'textarea') $(el).attr('name', 'review').attr('required', '').attr('id', 'f-review');
  });
  // optional email so she can reply — inserted as a sibling INSIDE the form
  const ta = form.find('textarea').first();
  let anchor = ta;
  while (anchor.length && !anchor.parent().is(form)) anchor = anchor.parent();
  if (!anchor.length) throw new Error('reviews: could not find a form-level anchor');
  anchor.before(field('email', 'Your email <span style="font-weight:600;opacity:.65">(optional — so she can reply)</span>', 'email', 'you@example.com', false));
  form.find('button[type="submit"], button').filter((i, e) => /send my review/i.test($(e).text())).attr('type', 'submit');
  for (const n of ['name', 'pet', 'review', 'email', 'rating', 'service'])
    if (!form.find('[name="' + n + '"]').length) throw new Error('reviews: field "' + n + '" missing from form');
  return form;
}

function doBooking($, $3plus) {
  const form = $('form').first();
  formShell($, form, 'New booking enquiry from the Katty & Co. website');

  // count chips + service chips
  $('button').filter((i, e) => ['1', '2', '3+'].includes($(e).text().trim()))
    .each((i, el) => $(el).attr('data-chip', 'count').attr('data-val', $(el).text().trim()).attr('type', 'button'));
  $('button').filter((i, e) => ['Boarding', 'Day care', 'Drop-ins', 'Walks'].includes($(e).text().trim()))
    .each((i, el) => $(el).attr('data-chip', 'service').attr('data-val', $(el).text().trim()).attr('type', 'button'));
  form.prepend('<input type="hidden" name="pet_count" id="f-pet_count" value="1">' +
               '<input type="hidden" name="service" id="f-service" value="Boarding">');

  // the pet block is the bordered div whose first span reads "Pet N" and which holds the fields
  const blocks = form.find('div').filter((i, e) => {
    const t = $(e).children('span').first().text().trim();
    return /^Pet [12]$/.test(t) && $(e).find('input,select').length >= 2;
  });
  if (blocks.length !== 2) throw new Error('booking: expected 2 pet blocks, found ' + blocks.length);
  blocks.each((i, el) => {
    const legend = $(el).children('span').first();
    const n = legend.text().trim().slice(-1);
    $(el).attr('data-pet-block', n);
    legend.attr('data-pet-legend', n);
    $(el).find('input,select').each((j, f) => {
      const ph = ($(f).attr('placeholder') || '');
      const key = f.tagName === 'select' ? 'species' : (/Chihuahua|Jack Russell/.test(ph) ? 'breed' : 'name');
      $(f).attr('name', 'pet' + n + '_' + key);
    });
  });
  // dates
  form.find('input[type="date"]').each((i, el) => $(el).attr('name', i === 0 ? 'date_from' : 'date_to'));

  // lift the "3+" crew block out of the 3plus capture, inside the form
  const crewSrc = $3plus('textarea').first().parent();
  if (!crewSrc.length) throw new Error('booking: crew block not found in 3plus capture');
  const block2 = form.find('[data-pet-block="2"]');
  block2.after($3plus.html(crewSrc));
  const crew = block2.next();
  crew.attr('data-crew-block', '').attr('hidden', 'hidden');
  crew.find('textarea').attr('name', 'crew');

  // cap note
  crew.after('<p data-cap-note hidden style="margin:10px 0 0; padding:14px 16px; border:3px solid #2B1D18; border-radius:16px; background:#F7BE45; font-weight:700; font-size:15px;"></p>');
  if (!form.find('[data-crew-block]').length || !form.find('[data-cap-note]').length)
    throw new Error('booking: crew/cap-note not inside form');

  // contact block — the form had NO way to reach the sender
  const contact = '<div data-contact style="display:grid; gap:14px; margin-top:18px;">' +
    '<h3 style="margin:0; font-family:\'Baloo 2\',cursive; font-weight:800; font-size:clamp(19px,2.2vw,22px);">How do I reach you?</h3>' +
    field('name', 'Your name', 'text', 'Alex Rivera', true) +
    field('email', 'Email', 'email', 'you@example.com', true) +
    field('phone', 'Phone <span style="font-weight:600;opacity:.65">(optional)</span>', 'tel', '604 555 0134', false) +
    field('notes', 'Anything else I should know? <span style="font-weight:600;opacity:.65">(optional)</span>', 'textarea', 'Medication, routines, nervous around other dogs, favourite games…', false) +
    '</div>';
  const submitBtn = form.find('button').filter((i, e) => /send it over/i.test($(e).text())).first();
  if (!submitBtn.length) throw new Error('booking: submit button not found');
  submitBtn.before(contact);           // must land INSIDE the form, not beside it
  submitBtn.attr('type', 'submit');
  for (const n of ['name', 'email', 'phone', 'notes', 'pet1_name', 'pet2_name', 'crew', 'date_from'])
    if (!form.find('[name="' + n + '"]').length) throw new Error('booking: field "' + n + '" missing from form');
  return form;
}

/* ---------- sent panel extraction ---------- */
function sentPanel(file, needle) {
  const $ = load(file);
  let best = null;
  $('body *').each((i, e) => { if ($(e).text().includes(needle)) { if (!best || $(e).parents().length > $(best).parents().length) best = e; } });
  let n = $(best), card = null;
  for (let d = 0; d < 8 && n.length; d++) { const st = n.attr('style') || ''; if (/border:|box-shadow/.test(st)) card = n; n = n.parent(); }
  if (!card) return '';
  card.attr('data-sent-panel', '').attr('hidden', 'hidden').attr('role', 'status').attr('tabindex', '-1');
  card.find('a[href],button').each((i, e) => {
    const t = $(e).text().trim();
    if (/send another|write another/i.test(t)) $(e).attr('data-sent-reset', '').attr('type', 'button').attr('href', '#');
  });
  card.find('[src]').each((i, e) => { const s = $(e).attr('src'); if (s && !/^(https?:|data:|\/)/.test(s)) $(e).attr('src', '/' + s); });
  return $.html(card);
}

/* ---------- main ---------- */
fs.mkdirSync(OUT, { recursive: true });
for (const p of PAGES) if (p.route) fs.rmSync(path.join(OUT, p.route), { recursive: true, force: true });

const HEADER_HTML = buildHeader();
const $3plus = load('booking-3plus');

const report = [];
for (const page of PAGES) {
  const $ = load(page.key === 'booking' ? 'booking-2' : page.key);

  // 1. swap in the canonical responsive header
  const hostHeader = $('header').first();
  const headerHost = hostHeader.parent().is('[data-sc-name="SiteHeader"], .sc-host') ? hostHeader.parent() : hostHeader;
  hostHeader.replaceWith(HEADER_HTML);

  // 2. page-specific work
  let sent = '';
  if (page.key === 'index') { const n = doIndex($); if (n !== 2) console.warn('  ! index: expected 2 pupils, found ' + n); }
  if (page.key === 'pack') doPack($);
  if (page.key === 'reviews') { const f = doReviews($); sent = sentPanel('reviews-sent', 'Thank you'); if (sent) f.after(sent); }
  if (page.key === 'booking') { const f = doBooking($, $3plus); sent = sentPanel('booking-sent', 'Got it'); if (sent) f.after(sent); }

  // 3. global rewrites
  rewriteLinks($);
  rewriteAssets($);
  stripDcAttrs($);
  addMeta($, page);

  // 4. mark active nav (header markup is shared, so scope by page)
  if (page.nav) $('head').append('\n<style>[data-nav="' + page.nav + '"]{background:' +
    ({ home: '#F7BE45', services: '#5CC3C9', about: '#B79BE6', pack: '#F4795B', reviews: '#F7BE45', faq: '#5CC3C9' }[page.nav]) + '}</style>');

  // 5. shared css + js
  $('head').append('\n<style>' + HEADER_CSS + hoverCss.join('\n') + '</style>');
  // unselected-chip colour differs between the two forms
  if (page.key === 'booking') $('body').attr('data-chip-idle', '#FFF4E4');
  if (page.key === 'reviews') $('body').attr('data-chip-idle', '#FFFCF6');
  $('body').append('\n<script src="/assets/site.js" defer></script>');

  // 6. write
  const dir = page.route ? path.join(OUT, page.route) : OUT;
  fs.mkdirSync(dir, { recursive: true });
  const html = '<!DOCTYPE html>\n' + $.html($('html')).replace(/^<!DOCTYPE[^>]*>\s*/i, '');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  report.push({ page: page.key, route: '/' + (page.route ? page.route + '/' : ''), bytes: html.length });
}

/* ---------- assets ---------- */
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'site.js'), path.join(OUT, 'assets', 'site.js'));

// only the images the pages actually reference
const referenced = new Set();
for (const p of PAGES) {
  const dir = p.route ? path.join(OUT, p.route) : OUT;
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  // any root-relative local asset, not just img/ — a narrower pattern silently
  // dropped a photo the canvas had left at the source root
  for (const m of html.matchAll(/(?:src|href)="\/([^"]+\.(?:jpg|jpeg|png|svg|webp|gif|ico))"/gi)) referenced.add(m[1]);
}
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const UNRENAME = Object.fromEntries(Object.entries(ASSET_RENAME).map(([k, v]) => [v, k]));
const MAX_BYTES = 900 * 1024;   // anything larger is a raw camera file, not a web image
let copied = 0, missing = [], shrunk = [], stripped = [], rotated = [];
for (const rel of referenced) {
  const from = path.join(SRC, UNRENAME[rel] || rel);
  if (!fs.existsSync(from)) { missing.push(rel); continue; }
  const to = path.join(OUT, rel);
  fs.copyFileSync(from, to);
  copied++;
  // bake in EXIF rotation BEFORE the metadata carrying it gets stripped
  if (/\.jpe?g$/i.test(to)) {
    const o = exifOrientation(to);
    if (o && o !== 1) {
      const deg = ROTATION_FOR[o];
      if (deg === undefined) console.warn('  ! ' + rel + ' has mirrored EXIF orientation ' + o + ' — not handled, check it by eye');
      else {
        try {
          require('child_process').execFileSync('sips', ['-r', String(deg), to], { stdio: 'ignore' });
          rotated.push(rel + ' (' + deg + '°)');
        } catch (e) { console.warn('  ! ' + rel + ' needs a ' + deg + '° rotation but sips is unavailable'); }
      }
    }
  }
  // downscale oversized originals in place (macOS sips; skipped elsewhere)
  if (fs.statSync(to).size > MAX_BYTES) {
    const before = fs.statSync(to).size;
    try {
      require('child_process').execFileSync('sips', ['-Z', '1200', '-s', 'formatOptions', '80', to], { stdio: 'ignore' });
      shrunk.push(rel + ': ' + Math.round(before / 1024) + 'KB -> ' + Math.round(fs.statSync(to).size / 1024) + 'KB');
    } catch (e) {
      console.warn('  ! ' + rel + ' is ' + Math.round(before / 1024) + 'KB and could not be resized (sips unavailable)');
    }
  }
  if (/\.jpe?g$/i.test(to) && stripJpegMetadata(to)) stripped.push(rel);
}

// robots + sitemap
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: ' + ORIGIN + '/sitemap.xml\n');
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  PAGES.map(p => '  <url><loc>' + ORIGIN + '/' + (p.route ? p.route + '/' : '') + '</loc></url>').join('\n') +
  '\n</urlset>\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

/* ---------- guards: the same failure that broke the old bundle must not ship ---------- */
const GUARDS = [
  [/\{\{\s*[A-Za-z_]/g, 'un-compiled {{ binding }}'],
  [/sc-camel-on-/g, 'un-compiled sc-camel handler'],
  [/<sc-(if|for)\b/g, 'un-compiled control-flow tag'],
  [/<dc-import\b/g, 'un-resolved component import'],
  [/style-(hover|active)=/g, 'un-converted state style'],
  [/unpkg\.com/g, 'CDN dependency'],
  [/support\.js/g, 'design-time runtime'],
  [/\.dc\.html/g, 'canvas-source link'],
];
let failures = 0;
for (const p of PAGES) {
  const dir = p.route ? path.join(OUT, p.route) : OUT;
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  for (const [re, label] of GUARDS) {
    const m = html.match(re);
    if (m) { console.error('  FAIL ' + p.key + ': ' + m.length + ' x ' + label); failures++; }
  }
  if (!/<html lang="en"/.test(html)) { console.error('  FAIL ' + p.key + ': missing lang'); failures++; }
  if (!/meta name="description"/.test(html)) { console.error('  FAIL ' + p.key + ': missing description'); failures++; }
}

console.table(report);
console.log('hover rules generated:', hoverCss.length);
console.log(failures ? '\n*** ' + failures + ' GUARD FAILURE(S) ***' : '\nguards: all pages clean');
console.log('images copied:', copied);
rotated.forEach(s => console.log('  rotated ' + s));
shrunk.forEach(s => console.log('  downscaled ' + s));
if (stripped.length) console.log('  stripped EXIF/GPS from: ' + stripped.join(', '));
if (missing.length) { console.error('*** MISSING ASSETS (pages reference these but they do not exist): ***'); missing.forEach(m => console.error('  ' + m)); }
console.log(failures || missing.length ? 'BUILD NOT SAFE TO PUSH' : 'build ok');
process.exit(failures || missing.length ? 1 : 0);

# Reply & Close — entry landing page

A plain static site for "The 24/7 Sales Engine" (₦2,500 Guide + Workbook). No framework, no build step, no backend.

## Where to edit

All editable values live in one `CONFIG` object at the top of `script.js`:

- `PRICE` / `WAS_PRICE` — the current and "previously" price shown on the page.
- `SELAR_URL` — **TODO**, not yet set. Paste the Selar product link for the ₦2,500 product. Every "Get Instant Access" button reads this value.
- `SUPPORT_EMAIL` — **TODO**, not yet set. The email shown in the footer, the FAQ and the policy pages.
- `WHATSAPP_URL` — optional. Leave empty to hide the WhatsApp footer link, or set it (e.g. `https://wa.me/234XXXXXXXXXX`) to show it.
- `META_PIXEL_ID` — set to the Pixel ID carried over from the previous version of this page. Leave empty to load no tracking at all.

Until `SELAR_URL` and `SUPPORT_EMAIL` are filled in, the page still renders correctly, but the CTA buttons and the contact/footer links point at literal `TODO:...` placeholders so a missing value is obvious rather than silently broken.

## Previewing locally

No build step is needed. From this folder, run a static file server, for example:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in a browser.

## Deploying to Vercel

This folder is already a plain set of static files, which is all Vercel's free plan needs:

1. Push this repository to GitHub (already done if you're reading this from the repo).
2. In Vercel, "Add New… → Project", import the repo, and leave the framework preset as "Other" and the build command empty — there is nothing to build.
3. Deploy. Vercel serves `index.html`, `styles.css`, `script.js`, `assets/`, and the three policy pages as-is.

If you later add Vercel Web Analytics, paste its snippet into `index.html`'s `<head>`.

## Remaining TODOs in the files

- `script.js`: `CONFIG.SELAR_URL` — needs the real Selar checkout link for the ₦2,500 product.
- `script.js`: `CONFIG.SUPPORT_EMAIL` — needs a real support contact email.
- `index.html` hero trust grid: "Fill in on your phone or print (TODO: confirm phone-fill works)".
- `index.html` FAQ, "How does delivery work?": "TODO: confirm that the link arrives instantly."
- `index.html` FAQ, "Can I fill it in on my phone?": "TODO: confirm which phone viewer works best, then say so here."
- `privacy.html` and `terms.html`: both start with a visible "TODO: review before launch" note — these are short plain-language drafts, not reviewed legal text.
- A commented-out `<!-- REVIEWS: ... -->` marker sits where a reviews section would go in `index.html`, intentionally left empty (no real, permitted buyer quotes exist yet).

## Checks that could not be run here

- No real device/browser testing (iOS Safari phone-fill behaviour for the Workbook's fillable PDF fields, actual Selar checkout flow, actual email delivery timing) — the three FAQ TODOs above depend on this.
- No `cwebp` CLI was available in the build environment; WebP versions of the 10 product images were generated with Python/Pillow instead (`guide-p1.webp`, etc., sitting next to each `.png` fallback in `assets/`). Visually spot-checked, but not compared byte-for-byte against `cwebp` output.

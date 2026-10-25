# Moz Discounts marketing site

A static, motion-filled glassmorphism website (plain HTML, CSS and JS, no build step).

## Files
- `index.html` - page content
- `styles.css` - design tokens, layout and animation styles
- `main.js` - scroll-driven parallax (street story, iOS and web walkthroughs, developers)
- `assets/` - logo and app screenshots
- `vercel.json` - clean URLs and asset caching

## Add to the Discount-App repo
Copy this folder into the repo root as `site/` (do not touch `apps/` or `packages/`):

    unzip moz-discounts-site.zip
    cp -r moz-discounts-site/site /path/to/Discount-App/site

## Deploy on Vercel (separate project)
1. Vercel dashboard > Add New > Project > import `jkbytesjr/Discount-App`.
2. Set **Root Directory** to `site`, **Framework Preset** to `Other`.
3. Leave build command and output directory empty. Deploy.

Do not change the existing `discount-app` project, which builds `apps/web`.

## Preview locally

    cd site && python3 -m http.server 8123

Then open http://localhost:8123

## Notes
- Respects `prefers-reduced-motion` (shows still versions).
- Links go to the live app: `/login`, `/register`, `/map`, `/privacy`.
- The TestFlight section asks people to request an invite. Add a public TestFlight link in `index.html` (id `testflight`) when you have one.
- Fonts (Montserrat, Manrope) load from Google Fonts.

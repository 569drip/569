# V.VI.IX — Fourthwall storefront

Static GitHub Pages frontend connected directly to the Fourthwall Storefront API.

- Products, prices, variants and images come from Fourthwall.
- Currency is detected from the browser timezone/region and can be changed manually.
- Cart state is stored in the browser and managed through Fourthwall's Storefront API.
- Checkout is hosted by Fourthwall.

## Running a drop (no code)

Everything drop-specific lives in **`assets/data/drop.json`**. Edit it through **Pages CMS** — a free form over the file, no server:

1. Go to <https://app.pagescms.org>, sign in with GitHub, open this repository.
2. **Drop control** appears as a form (configured by `.pages.yml`).
3. Save. GitHub Pages redeploys in about a minute.

### A drop, start to finish

| You do | In |
|---|---|
| Design products, keep them **hidden** | Fourthwall |
| Status **Coming soon** | Pages CMS |
| Set launch date + timezone, status **Countdown** | Pages CMS |
| *Site flips to Live by itself at launch time* | — |
| **Unhide** the products | Fourthwall |
| When it sells out, nothing — the site notices every product is unavailable | — |
| Next drop: **Drop number** +1, status **Coming soon** | Pages CMS |

The site cannot unhide Fourthwall products for you. If launch time passes while they are still hidden, the shop shows a "landing any second" note and re-checks every 30 seconds for 10 minutes.

### What follows the state automatically

Eyebrows, hero and header buttons (shop link when live, sign-up link otherwise), a countdown on Home and Shop, the shop grid vs. a sign-up block, the newsletter heading (`{upcoming}` = this drop before launch, the next one after), run size, page titles, product-card labels, and the footer link.

### Per-drop collections

Each drop can point at its own Fourthwall collection (`collection` field, e.g. `drop-002`). Until you create those, keep `all`.

### Preview before publishing

Add to any page URL — only you see it, a chip in the corner marks it:

- `?drop_preview=countdown` · `live` · `sold-out` · `coming-soon`
- `?drop_launch_in=60` — a real countdown that goes live in 60 seconds

### Wording tokens

`{drop}` Drop 001 · `{next}` Drop 002 · `{upcoming}` · `{run}` 150 pieces · `{pieces}` live product count · `{launch}` launch time in the visitor's own timezone. A line break in a text field becomes a line break on the page. Empty fields fall back to the default wording in `assets/js/drop.js`.

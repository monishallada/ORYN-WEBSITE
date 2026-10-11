# ORYN — Autonomous Aerial Intelligence

The public marketing website for ORYN: aircraft (ORYN Aero), computer vision and geospatial analysis (ORYN Intelligence), operations software (ORYN Command), and the customer dashboard (ORYN Portal).

Built with Next.js (App Router), TypeScript, Tailwind CSS v4, and Motion. It deploys to Vercel with no extra configuration.

---

## Quick start

Requirements: **Node.js 20.9 or later** (22 LTS recommended) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create a production build (also type-checks) |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | Type-check without building |

## Environment variables

Copy `.env.example` to `.env.local` for local development. On Vercel, add the variables under **Project → Settings → Environment Variables**.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical URL used for metadata, the sitemap, and Open Graph. If unset, the site uses Vercel's production URL, then `http://localhost:3000`. |
| `RESEND_API_KEY` | For the contact form | API key from [Resend](https://resend.com). |
| `CONTACT_TO_EMAIL` | For the contact form | Where inquiries are delivered. Separate multiple addresses with commas. |
| `CONTACT_FROM_EMAIL` | For the contact form | A sender on a domain you have verified in Resend, e.g. `ORYN Website <website@yourdomain.com>`. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional | A public inquiry address, shown as a fallback on the contact page. |
| `NEXT_PUBLIC_COMMAND_URL` | Optional | URL of the future ORYN Command app. When set, a **Sign in** link appears in the header. |

### Contact form behavior

The form (`/contact`, and `/contact?intent=demo` for demo requests) posts to `src/app/api/contact/route.ts`. It is honest about whether delivery is configured:

- **All three `RESEND_*` / `CONTACT_*` variables set:** submissions are emailed through Resend's REST API, with the visitor's address as `reply_to`.
- **Development without them:** submissions are validated and logged to the server console. The visitor sees a note that delivery isn't configured.
- **Production without them:** the API returns `503 not_configured`. The visitor is told the message was **not** sent (and shown `NEXT_PUBLIC_CONTACT_EMAIL`, if set).

Spam protection: a honeypot field, a minimum time-to-submit check, server-side validation with `zod`, length limits, and a best-effort in-memory rate limit (5 requests per 10 minutes per IP, per server instance). For stronger protection in production, add a Vercel Firewall rate-limit rule on `/api/contact`, or add a CAPTCHA such as Cloudflare Turnstile.

## Deploying

### Vercel (recommended)

1. Push this repository to GitHub (see below).
2. In Vercel, choose **Add New → Project** and import the repository. The framework preset (Next.js) is detected automatically; no build settings need to change.
3. Add the environment variables above. Set `NEXT_PUBLIC_SITE_URL` to your final domain.
4. Deploy. To add a custom domain, use **Project → Settings → Domains** and follow the DNS instructions (for a GoDaddy domain, add the A/CNAME records Vercel shows in GoDaddy's DNS settings).

Or deploy from the command line:

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

### GitHub

```bash
git add .
git commit -m "ORYN website"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git   # skip if already set
git push -u origin main
```

Once the repository is connected to Vercel, every push to `main` deploys to production and every pull request gets a preview URL.

## Project structure

```
src/
  app/                    Routes (App Router)
    page.tsx              Home
    technology/ aero/ intelligence/ platform/ solutions/ solutions/[slug]/
    about/ contact/ credits/
    api/contact/route.ts  Contact form endpoint
    layout.tsx            Fonts, metadata, header/footer, JSON-LD
    template.tsx          Page transition on client navigation
    sitemap.ts robots.ts manifest.ts icon.svg apple-icon.png favicon.ico opengraph-image.png
    globals.css           Design system: Tailwind v4 theme tokens and type scale
  components/
    brand/                ORYN logo (vector, from master artwork)
    layout/               Header, mobile menu, footer, page hero
    home/                 Home-page sections
    previews/             Interactive ORYN Command and ORYN Portal previews
    viz/                  Comparison slider, demos, blueprint, mosaic, report
    aero/ tech/ contact/ media/ ui/
  content/                All copy and data. Edit these files to change the site.
  assets/                 Statically imported images (blur placeholders, hashing)
public/
  brand/                  Standalone logo SVGs
  media/video/            Hero and flyover video
  media/map/              Command preview map layers (USGS public domain)
scripts/                  Reproducible asset-generation scripts (see scripts/README.md)
```

**Tailwind configuration:** Tailwind v4 is configured CSS-first. Colors, fonts, breakpoints, and animations are defined in the `@theme` block of `src/app/globals.css`, and the type scale (`t-display`, `t-h1` … `t-mono`) is defined there as `@utility` rules. No `tailwind.config` file is needed.

## Editing content

Most changes don't require touching components:

| To change… | Edit |
| --- | --- |
| Navigation, footer links, site description | `src/content/site.ts` |
| Industry pages (copy, images, status) | `src/content/industries.ts` |
| A1 specifications, modules, roadmap | `src/content/aero.ts` |
| Architecture stages, pillars, principles | `src/content/technology.ts` |
| Command preview sample missions | `src/content/missions.ts` |
| Intelligence demos | `src/content/intelligence.ts` |
| Team (About page) | `src/content/team.ts` |
| Images, alt text, credits | `src/content/media.ts`, `src/content/credits.ts`, `MEDIA_CREDITS.md` |

### Content integrity rules

ORYN is early-stage. The site is written to be ambitious but accurate:

- **Specifications** in `src/content/aero.ts` are `null` ("To be established") until they are measured. Only add a value once it has been validated.
- **Team:** `src/content/team.ts` is empty on purpose. Add real people only; the About page shows a founder-led statement until then.
- **Previews** (Command, Portal, the Intelligence demos) are labeled "Interactive product preview", "Concept preview", "Sample data", or "Illustrative". Keep those labels until they connect to production systems.
- **Third-party hardware** in photos is captioned "Representative — not ORYN hardware." Replace it with real ORYN prototype photography when available.
- **No** fabricated customers, partners, certifications, statistics, or testimonials.

## Connecting ORYN Command later

The marketing site and the future applications are designed to deploy separately:

- Deploy ORYN Command and ORYN Portal as their own applications, for example `command.yourdomain.com` and `portal.yourdomain.com` as separate Vercel projects.
- Set `NEXT_PUBLIC_COMMAND_URL` to show a **Sign in** link in the header.
- The preview components in `src/components/previews/` can serve as UI references. Their data model is in `src/content/missions.ts`.

## Accessibility and performance

- Semantic landmarks, a skip link, visible focus states, and keyboard support throughout: the slider responds to arrow, Home, and End keys; tab lists use arrow keys; the mobile menu traps focus and closes on Escape.
- `prefers-reduced-motion` is respected: CSS animations are disabled, Motion reduces animation, scroll-linked effects become static, and hero video does not autoplay.
- Hero video is skipped when Save-Data is on, pauses when off-screen, and has a pause control. A server-rendered poster is the LCP element.
- Images go through `next/image` (AVIF/WebP, responsive sizes, lazy loading, blur placeholders).
- Automated checks: axe-core reports no WCAG 2 A/AA violations; there are no console or hydration errors and no horizontal overflow at 390 px and 1440 px.

## Media and licensing

See [`MEDIA_CREDITS.md`](./MEDIA_CREDITS.md) (also published at `/credits`). Photography comes from Unsplash and video from Mixkit, both under free commercial licenses. Map, elevation, and satellite data come from USGS and NASA and are public domain or open data.

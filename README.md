# DidIFkUp MVP

React + TypeScript + Vite app with Tailwind CSS v4 and a shadcn-style UI component bundle. The `App.tsx` is a showcase that demonstrates the landing page, hero demo, example output, pricing, and the full “run it” app with paywall dialog.

## Stack

- **React 19** with **TypeScript**
- **Vite 6** (modern build)
- **Tailwind CSS v4** (`@tailwindcss/vite`, theme in `src/index.css`)
- **tw-animate-css** for enter/exit animations
- **Radix UI** (Dialog, Select, Tabs, Slot)
- **Framer Motion** for animations
- **Lucide React** for icons
- **class-variance-authority** + **clsx** + **tailwind-merge** for `cn()` and variants

## Setup

1. **Install dependencies** (requires network):

   ```bash
   npm install
   ```

2. **Run dev server**:

   ```bash
   npm run dev
   ```

   For local `/api/*` calls (e.g. `/api/analyze`), run **both** terminals:
   - **Terminal 1:** `npm run dev` — Vite frontend at http://localhost:5173
   - **Terminal 2:** `npm run dev:api` — Vercel serverless at http://localhost:3000

   Vite proxies `/api` to the Vercel dev server, so relative API URLs work.

3. **Build for production**:

   ```bash
   npm run build
   ```

4. **Preview production build**:

   ```bash
   npm run preview
   ```

## Project structure

- **`src/`**
  - **`main.tsx`** – Entry point; mounts `App` with `index.css`.
  - **`App.tsx`** – Showcase app: landing, hero demo, “See an example”, pricing, and the full app page (analysis form, result panel, paywall dialog). Exports `App` by default (renders `LandingPage`). Includes a `Navigation` component that toggles between landing and app.
  - **`index.css`** – Tailwind v4 imports, `@theme` variables (light/dark), base layer, and utilities (e.g. `grain-texture`, `glass-card`, `animated-gradient`).
  - **`lib/utils.ts`** – `cn(...)` and `cardPremium` (premium card class combo).
  - **`components/ui/`** – Reusable UI: `button`, `card`, `textarea`, `select`, `tabs`, `badge`, `dialog`.
  - **`components/BackgroundFX.tsx`** – Signature backdrop: soft gradient blobs, dotted grid, grain overlay. Respects `prefers-reduced-motion`.
  - **`components/CopyToast.tsx`** – Local “Copied!” pill for copy actions.

Imports use the `@/` alias (e.g. `@/lib/utils`, `@/components/ui/button`) resolved to `src/` in `vite.config.ts` and `tsconfig.app.json`.

## App showcase (App.tsx)

- **LandingPage** – Hero with mascot, CTA, “See an example”, hero demo widget, social proof bubbles, “How it works” cards, expandable example result (verdict, reasons, next move, follow-up tabs, share card), and pricing (Free / Pro).
- **AppPage** – Analysis UI: textareas (what happened / what you said / what they said), Relationship + Context selects, Analyze button, checks-left pill, spiral mode toggle, result card (verdict, confidence meter, reasons, next move, follow-up tabs with copy, share/download), and paywall dialog when out of checks.
- **Navigation** – Sticky nav with logo, “Try It” / Pricing / How It Works, Sign In, and mobile menu; switches between `LandingPage` and `AppPage`.

Default export is `App` → `<LandingPage />`. To run the full app with nav, change the default export in `App.tsx` to:

```tsx
export default function App() {
  return <Navigation />;
}
```

## Styling

- **Theme** – CSS variables in `:root` and `.dark` in `src/index.css`; Tailwind v4 `@theme inline` maps them to `--color-*` and `--radius-*` for use with utility classes.
- **Utilities** – `grain-texture`, `glass-card`, `animated-gradient` are defined in `@layer utilities` in `src/index.css`.

## If your project doesn’t have this stack

1. **React + TypeScript** – Create with `npm create vite@latest my-app -- --template react-ts`, then add the rest.
2. **Tailwind v4** – `npm install tailwindcss @tailwindcss/vite tw-animate-css`, add `@tailwindcss/vite` to `vite.config.ts` plugins, and in your main CSS: `@import "tailwindcss";` and `@import "tw-animate-css";` plus your theme/utilities.
3. **Dependencies for this bundle** – From the project root run:

   ```bash
   npm install framer-motion lucide-react @radix-ui/react-slot class-variance-authority @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-dialog clsx tailwind-merge
   ```

Then copy `src/lib/utils.ts`, `src/components/ui/*`, and the relevant parts of `src/index.css` (theme variables and utilities) into your app, and keep the `@` path alias for `src/` (or adjust imports to your structure).

---

## Visual polish (X factor)

### What changed

- **BackgroundFX** – Reusable backdrop on Landing + App: soft animated gradient blobs (lime/teal/purple), faint dotted grid, tasteful grain overlay. `pointer-events: none`, `z-index` below content. Blobs and grain respect `prefers-reduced-motion` (blobs not rendered when reduced motion).
- **Premium cards** – Single pattern: `.card-premium` (border, hover ring, inner shine, edge-light gradient via `::before`). Applied to How it works, HeroDemoWidget, example output, input/results/empty panel, pricing cards. Inner shine via `.card-premium-shine` child.
- **Buttons** – Primary CTAs use `.btn-cta-primary`: sheen sweep on hover (CSS `::after`), tactile press (`active:scale-[0.98]`), stronger `focus-visible` ring. Outline buttons use `.btn-outline-snappy`: hover lift, border shift, focus ring.
- **Typography + spacing** – `.text-display` / `.text-section-title` (tighter tracking), `.section-padding`, `.content-max-width` (72rem), `leading-snug` / `leading-relaxed` on body copy.
- **Micro-interactions** – Analyze button: loading glow (ring + shadow) while analyzing. Results: pop + settle spring, reasons stagger with spring. Copy: local `CopyToast` pill above copy button (ShareCard + follow-up texts).
- **Reduced motion** – `useReducedMotion()` from framer-motion used in Mascot, ConfidenceMeter, HeroDemoWidget (“Try me” arrow), AppPage (Analyze spinner, empty-state pulse/float). When true: no infinite animations, instant or no transition.

### Where to tweak intensity

- **Blobs** – `src/index.css`: `.bg-fx-blob` opacity (e.g. `0.12` → `0.08` for subtler), blob animation keyframes duration (e.g. `25s` → `35s` for slower).
- **Grain** – `src/index.css`: `.bg-fx-grain` opacity in the SVG data URL (e.g. `0.02` → `0.015`).
- **Card hover** – `src/index.css`: `.card-premium:hover` `box-shadow` and `border-color`.
- **Button sheen** – `src/index.css`: `.btn-cta-primary::after` gradient opacity and `transition` duration.
- **Springs** – `src/App.tsx`: results panel `stiffness`/`damping`, reasons stagger `delay` and spring params.
# didifkup

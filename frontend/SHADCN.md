# shadcn/ui in Cyberstorm SIEM (Vite + React)

This project uses the **shadcn/ui folder layout** with Vite (not Next.js).

## Already configured

- **TypeScript** — `tsconfig.app.json`
- **Tailwind CSS v4** — `@tailwindcss/vite` in `vite.config.ts`, styles in `src/index.css`
- **`@/` path alias** — `vite.config.ts` + `tsconfig.app.json`
- **`src/lib/utils.ts`** — `cn()` helper (clsx + tailwind-merge)
- **`src/components/ui/`** — shadcn components (e.g. `dotted-surface.tsx`)
- **`components.json`** — shadcn CLI config

## Add more shadcn components

From the `frontend` folder:

```bash
npx shadcn@latest add button card
```

## Why `components/ui`?

shadcn expects shared primitives under `src/components/ui` so CLI installs stay consistent and imports stay `@/components/ui/...`.

## Note on `next-themes`

The original Dotted Surface snippet used `next-themes` (Next.js only). This app uses a fixed **Cyberstorm dark** palette via the `surfaceTheme` prop instead.

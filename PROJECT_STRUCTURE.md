# Project Structure

- components/
  - ui/        # ShadCN UI components
  - shared/    # Shared, non-UI components
- pages/       # Next.js pages
- utils/       # Utility/helper functions
- hooks/       # Custom React hooks
- styles/      # Global and modular styles
- lib/         # Libraries or API clients 

## App Directory & Routing Structure (Next.js App Router)

- The `app/` directory will be the root for all route segments and layouts using the Next.js App Router.
- Key files and folders:
  - `app/layout.tsx`: Root layout, wraps all pages, includes global providers (e.g., ThemeProvider), and imports global styles.
  - `app/page.tsx`: Home page (`/`).
  - `app/upload/page.tsx`: Upload page (`/upload`).
  - `app/results/page.tsx`: Results page (`/results`).
  - (Optional) `app/results/[id]/page.tsx`: Dynamic route for individual results.
- Navigation and shared UI components should be placed in `components/` and imported as needed.
- All global styles are imported in `app/layout.tsx`.
- The legacy `pages/` directory will be deprecated after migration is complete. 
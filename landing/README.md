# SpeakEasy Landing Page

A clean, simple landing page for the SpeakEasy text-to-speech library.

## Features

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **Interactive code examples** with syntax highlighting
- **Responsive design** for all devices

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun start
```

## Structure

- `/app` - Next.js app router pages
- `/components` - React components
  - `hero-section.tsx` - Main hero with SpeakEasy branding
  - `code-examples.tsx` - Interactive code examples
  - `features-section.tsx` - Feature highlights
  - `installation-section.tsx` - Installation instructions
- `/lib` - Utility functions
- `/styles` - Global CSS styles

## Deployment

The public site is a static Next.js export hosted on GitHub Pages at
https://speakeasy.arach.dev. The Deploy Landing Page workflow builds pull requests
and deploys changes to `master`. It can also be dispatched manually on `master`.

```bash
bun install --frozen-lockfile
bun run build
```

The release version and asset URLs are defined in `lib/release.ts`. Live HTML pages
in `mocks/` use release placeholders resolved by `lib/mock-page.tsx`, so the home
and Pad download buttons follow the same version as the component-based pages.
Publish the matching signed DMG assets before deploying a version bump. Keep the
iPad interest form until a working public TestFlight invitation is available.

## Customization

- Update colors in `tailwind.config.ts`
- Modify components in `/components`
- Add new sections by creating components and importing in `page.tsx`
- Update metadata in `app/layout.tsx`
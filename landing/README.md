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
npm install --legacy-peer-deps

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
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

The landing page can be deployed to any static hosting platform:

- Vercel (recommended for Next.js)
- Netlify
- GitHub Pages (with static export)
- AWS S3 + CloudFront

For static export:
```bash
npm run build
```

## Customization

- Update colors in `tailwind.config.ts`
- Modify components in `/components`
- Add new sections by creating components and importing in `page.tsx`
- Update metadata in `app/layout.tsx`
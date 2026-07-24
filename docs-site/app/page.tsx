import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">SpeakEasy</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Unified text-to-speech library with multi-provider support
        </p>
        <Link
          href="/docs"
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          View Documentation
        </Link>
      </div>
    </main>
  );
}

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  Terminal, 
  Code, 
  Settings, 
  Server, 
  Database, 
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { readFile } from 'fs/promises';
import { join } from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/code-block';

// Import highlight.js theme
import 'highlight.js/styles/github.css';

interface DocPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Define the documentation structure
const docsStructure = [
  {
    slug: 'overview',
    title: 'Overview',
    icon: BookOpen,
    description: 'Quick start and overview'
  },
  {
    slug: 'cli',
    title: 'CLI Reference',
    icon: Terminal,
    description: 'Command-line interface'
  },
  {
    slug: 'sdk',
    title: 'SDK Guide',
    icon: Code,
    description: 'TypeScript SDK'
  },
  {
    slug: 'configuration',
    title: 'Configuration',
    icon: Settings,
    description: 'Setup and customization'
  },
  {
    slug: 'providers',
    title: 'Providers',
    icon: Server,
    description: 'TTS provider setup'
  },
  {
    slug: 'cache',
    title: 'Cache System',
    icon: Database,
    description: 'Cache management'
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    icon: HelpCircle,
    description: 'Common issues and solutions'
  }
];

function getDocBySlug(slug: string) {
  return docsStructure.find(doc => doc.slug === slug);
}

function getDocNavigation(currentSlug: string) {
  const currentIndex = docsStructure.findIndex(doc => doc.slug === currentSlug);
  const prev = currentIndex > 0 ? docsStructure[currentIndex - 1] : null;
  const next = currentIndex < docsStructure.length - 1 ? docsStructure[currentIndex + 1] : null;
  return { prev, next };
}

async function loadMarkdownContent(slug: string) {
  try {
    // Go up one level from landing directory to access docs
    const docsDir = join(process.cwd(), '..', 'docs');
    // Map overview to README.md
    const fileName = slug === 'overview' ? 'README.md' : `${slug}.md`;
    const filePath = join(docsDir, fileName);
    const content = await readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`Failed to load markdown content for ${slug}:`, error);
    return null;
  }
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  
  if (!doc) {
    return {
      title: 'Page Not Found - SpeakEasy Docs',
    };
  }

  return {
    title: `${doc.title} - SpeakEasy Documentation`,
    description: doc.description,
  };
}

export async function generateStaticParams() {
  return docsStructure.map((doc) => ({
    slug: doc.slug,
  }));
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  const markdownContent = await loadMarkdownContent(slug);
  
  if (!doc || !markdownContent) {
    notFound();
  }

  const { prev, next } = getDocNavigation(slug);
  const IconComponent = doc.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/docs/overview"
                className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                ← Back to Overview
              </Link>
              <div className="h-4 w-px bg-slate-300" />
              <div className="flex items-center gap-2">
                <IconComponent className="w-4 h-4 text-blue-600" />
                <div>
                  <h1 className="text-lg font-bold text-slate-900">{doc.title}</h1>
                  <p className="text-xs text-slate-600">{doc.description}</p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              Version 0.2.0
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm">
                <div className="p-3 border-b border-slate-200/60">
                  <h3 className="font-semibold text-sm text-slate-900">Documentation</h3>
                </div>
                <ScrollArea className="h-96">
                  <div className="p-2">
                    {docsStructure.map((docItem) => {
                      const DocIcon = docItem.icon;
                      const isActive = docItem.slug === slug;
                      return (
                        <Link
                          key={docItem.slug}
                          href={`/docs/${docItem.slug}`}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                            isActive
                              ? 'bg-blue-100 text-blue-900 font-medium'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <DocIcon className="w-3 h-3" />
                          <span>{docItem.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t border-slate-200/60">
                  <div className="space-y-1">
                    <Link
                      href="https://github.com/arach/SpeakEasy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <ExternalLink className="w-3 h-3" />
                      GitHub
                    </Link>
                    <Link
                      href="https://www.npmjs.com/package/@arach/speakeasy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <ExternalLink className="w-3 h-3" />
                      NPM Package
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm">
              <div className="px-8 py-10">
                {/* MDX Content */}
                <div className="prose prose-slate prose-sm max-w-none 
                  prose-headings:scroll-m-20 prose-headings:font-display
                  prose-h1:text-2xl prose-h1:font-light prose-h1:text-slate-900 prose-h1:mb-4 prose-h1:mt-5 prose-h1:leading-tight
                  prose-h2:text-lg prose-h2:font-medium prose-h2:text-slate-800 prose-h2:mb-3 prose-h2:mt-5 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2
                  prose-h3:text-base prose-h3:font-medium prose-h3:text-slate-700 prose-h3:mb-2 prose-h3:mt-4
                  prose-h4:text-sm prose-h4:font-medium prose-h4:text-slate-600 prose-h4:mb-2 prose-h4:mt-3
                  prose-p:text-sm prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-3 prose-p:font-text
                  prose-strong:text-slate-800 prose-strong:font-semibold
                  prose-ul:space-y-1 prose-li:text-sm prose-li:text-slate-600
                  prose-code:bg-slate-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-code:text-slate-800
                  prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:rounded-xl prose-pre:p-3 prose-pre:overflow-x-auto
                  prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 prose-blockquote:pl-3 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-sm prose-blockquote:text-slate-700
                  prose-table:text-sm prose-table:border-collapse
                  prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:text-blue-700 hover:prose-a:underline
                  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Custom heading styling with smaller typography
                      h1: (props: any) => (
                        <h1 className="text-2xl font-display font-light text-slate-900 mb-4 mt-5 leading-tight first:mt-0" {...props} />
                      ),
                      h2: (props: any) => (
                        <h2 className="text-lg font-display font-medium text-slate-800 mb-3 mt-5 border-b border-slate-200 pb-2" {...props} />
                      ),
                      h3: (props: any) => (
                        <h3 className="text-base font-display font-medium text-slate-700 mb-2 mt-4" {...props} />
                      ),
                      // Enhanced paragraph styling with smaller font
                      p: (props: any) => (
                        <p className="text-sm text-slate-600 leading-relaxed mb-3 font-text" {...props} />
                      ),
                      // Better list styling with smaller fonts
                      ul: (props: any) => (
                        <ul className="space-y-1 text-sm text-slate-600 mb-3" {...props} />
                      ),
                      li: (props: any) => (
                        <li className="leading-relaxed text-sm" {...props} />
                      ),
                      // Enhanced code block styling with syntax highlighting
                      pre: (props: any) => {
                        const { children } = props;
                        const child = children?.props;
                        if (child?.className?.includes('language-')) {
                          return (
                            <CodeBlock 
                              className={child.className}
                              children={child.children}
                            />
                          );
                        }
                        return (
                          <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-x-auto mb-4 text-xs" {...props} />
                        );
                      },
                      // Inline and block code handling
                      code: (props: any) => {
                        const { className, children, ...otherProps } = props;
                        const isInline = !className?.includes('language-');
                        
                        if (isInline) {
                          return (
                            <CodeBlock inline className={className} children={children} />
                          );
                        }
                        
                        // For code blocks, this will be handled by the pre component
                        return (
                          <code className={className} {...otherProps}>
                            {children}
                          </code>
                        );
                      },
                      // Enhanced table styling with smaller fonts
                      table: (props: any) => (
                        <div className="overflow-x-auto mb-4">
                          <table className="min-w-full border-collapse border border-slate-200 rounded-lg overflow-hidden text-sm" {...props} />
                        </div>
                      ),
                      th: (props: any) => (
                        <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-xs text-slate-700 font-text" {...props} />
                      ),
                      td: (props: any) => (
                        <td className="border border-slate-200 px-3 py-2 text-xs text-slate-600" {...props} />
                      ),
                      // Enhanced blockquote with smaller font
                      blockquote: (props: any) => (
                        <blockquote className="border-l-4 border-blue-500 bg-blue-50/50 pl-3 py-2 mb-3 italic text-sm text-slate-700" {...props} />
                      ),
                      // Custom link styling for external links and internal docs
                      a: (props: any) => {
                        const { href, children, ...otherProps } = props;
                        const isExternal = href?.startsWith('http');
                        
                        // Convert internal .md links to clean Next.js routes
                        let processedHref = href;
                        if (href && !isExternal && href.endsWith('.md')) {
                          // Remove .md extension and ensure it starts with /docs/
                          const fileName = href.replace('.md', '');
                          if (!fileName.startsWith('/docs/')) {
                            processedHref = `/docs/${fileName}`;
                          } else {
                            processedHref = fileName;
                          }
                        }
                        
                        return (
                          <a
                            href={processedHref}
                            className={`text-blue-600 font-medium no-underline hover:text-blue-700 hover:underline ${
                              isExternal ? 'after:content-["↗"] after:ml-1 after:text-xs' : ''
                            }`}
                            {...(isExternal && {
                              target: '_blank',
                              rel: 'noopener noreferrer'
                            })}
                            {...otherProps}
                          >
                            {children}
                          </a>
                        );
                      }
                    }}
                  >
                    {markdownContent}
                  </ReactMarkdown>
                </div>

                {/* Navigation Footer */}
                <div className="mt-12 pt-6 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      {prev && (
                        <Link href={`/docs/${prev.slug}`}>
                          <Button variant="outline" size="sm" className="group">
                            <ChevronLeft className="w-3 h-3 mr-1 group-hover:-translate-x-1 transition-transform" />
                            <div className="text-left">
                              <div className="text-xs text-slate-500">Previous</div>
                              <div className="font-medium text-xs">{prev.title}</div>
                            </div>
                          </Button>
                        </Link>
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      {next && (
                        <Link href={`/docs/${next.slug}`}>
                          <Button variant="outline" size="sm" className="group">
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Next</div>
                              <div className="font-medium text-xs">{next.title}</div>
                            </div>
                            <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  FileText,
  ExternalLink
} from 'lucide-react';

// Import highlight.js theme
import 'highlight.js/styles/github.css';

interface DocPageProps {
  params: {
    slug: string;
  };
}

// Define the documentation structure
const docsStructure = [
  {
    slug: 'overview',
    title: 'Overview',
    file: '../README.md',
    icon: BookOpen,
    description: 'Quick start and overview'
  },
  {
    slug: 'cli',
    title: 'CLI Reference',
    file: '../docs/cli.md',
    icon: Terminal,
    description: 'Command-line interface'
  },
  {
    slug: 'sdk',
    title: 'SDK Guide',
    file: '../docs/sdk.md',
    icon: Code,
    description: 'TypeScript SDK'
  },
  {
    slug: 'configuration',
    title: 'Configuration',
    file: '../docs/configuration.md',
    icon: Settings,
    description: 'Setup and customization'
  },
  {
    slug: 'providers',
    title: 'Providers',
    file: '../docs/providers.md',
    icon: Server,
    description: 'TTS provider setup'
  },
  {
    slug: 'cache',
    title: 'Cache System',
    file: '../docs/cache.md',
    icon: Database,
    description: 'Cache management'
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    file: '../docs/troubleshooting.md',
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

async function getDocContent(slug: string) {
  const doc = getDocBySlug(slug);
  if (!doc) return null;

  try {
    // Get the absolute path to the documentation file
    const docsDir = path.join(process.cwd(), doc.file);
    const fileContent = fs.readFileSync(docsDir, 'utf8');
    const { data, content } = matter(fileContent);
    
    return {
      ...doc,
      content,
      frontmatter: data
    };
  } catch (error) {
    console.error(`Error reading doc file for ${slug}:`, error);
    return null;
  }
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const doc = getDocBySlug(params.slug);
  
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
  const docContent = await getDocContent(params.slug);
  
  if (!docContent) {
    notFound();
  }

  const { prev, next } = getDocNavigation(params.slug);
  const IconComponent = docContent.icon;

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
                <IconComponent className="w-5 h-5 text-blue-600" />
                <h1 className="text-xl font-bold text-slate-900">{docContent.title}</h1>
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
                <div className="p-4 border-b border-slate-200/60">
                  <h3 className="font-semibold text-slate-900">Documentation</h3>
                </div>
                <ScrollArea className="h-96">
                  <div className="p-2">
                    {docsStructure.map((doc) => {
                      const DocIcon = doc.icon;
                      const isActive = doc.slug === params.slug;
                      return (
                        <Link
                          key={doc.slug}
                          href={`/docs/${doc.slug}`}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-blue-100 text-blue-900 font-medium'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <DocIcon className="w-4 h-4" />
                          <span>{doc.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="p-4 border-t border-slate-200/60">
                  <div className="space-y-2">
                    <Link
                      href="https://github.com/arach/SpeakEasy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                    >
                      <ExternalLink className="w-4 h-4" />
                      GitHub
                    </Link>
                    <Link
                      href="https://www.npmjs.com/package/@arach/speakeasy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                    >
                      <ExternalLink className="w-4 h-4" />
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
                {/* Page Header */}
                <div className="mb-10 pb-8 border-b border-slate-100">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100">
                      <IconComponent className="w-7 h-7 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h1 className="text-3xl font-display font-light text-slate-900 mb-3 leading-tight">{docContent.title}</h1>
                      <p className="text-base text-slate-600 font-text leading-relaxed">{docContent.description}</p>
                    </div>
                  </div>
                </div>

                {/* Markdown Content */}
                <div className="prose prose-slate max-w-none 
                  prose-headings:scroll-m-20 prose-headings:font-display
                  prose-h1:text-3xl prose-h1:font-light prose-h1:text-slate-900 prose-h1:mb-5 prose-h1:mt-6 prose-h1:leading-tight
                  prose-h2:text-xl prose-h2:font-medium prose-h2:text-slate-800 prose-h2:mb-3 prose-h2:mt-6 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2
                  prose-h3:text-lg prose-h3:font-medium prose-h3:text-slate-700 prose-h3:mb-2 prose-h3:mt-5
                  prose-h4:text-base prose-h4:font-medium prose-h4:text-slate-600 prose-h4:mb-2 prose-h4:mt-4
                  prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-4 prose-p:font-text
                  prose-strong:text-slate-800 prose-strong:font-semibold
                  prose-ul:space-y-2 prose-li:text-slate-600
                  prose-code:bg-slate-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-code:text-slate-800
                  prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-x-auto
                  prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-slate-700
                  prose-table:text-sm prose-table:border-collapse
                  prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:text-blue-700 hover:prose-a:underline
                  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight, rehypeRaw]}
                    components={{
                      // Custom heading styling with better typography
                      h1: ({ children, ...props }) => (
                        <h1 className="text-3xl font-display font-light text-slate-900 mb-5 mt-6 leading-tight first:mt-0" {...props}>
                          {children}
                        </h1>
                      ),
                      h2: ({ children, ...props }) => (
                        <h2 className="text-xl font-display font-medium text-slate-800 mb-3 mt-6 border-b border-slate-200 pb-2" {...props}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children, ...props }) => (
                        <h3 className="text-lg font-display font-medium text-slate-700 mb-2 mt-5" {...props}>
                          {children}
                        </h3>
                      ),
                      // Enhanced paragraph styling
                      p: ({ children, ...props }) => (
                        <p className="text-slate-600 leading-relaxed mb-4 font-text" {...props}>
                          {children}
                        </p>
                      ),
                      // Better list styling
                      ul: ({ children, ...props }) => (
                        <ul className="space-y-2 text-slate-600 mb-4" {...props}>
                          {children}
                        </ul>
                      ),
                      li: ({ children, ...props }) => (
                        <li className="leading-relaxed" {...props}>
                          {children}
                        </li>
                      ),
                      // Enhanced code block styling
                      pre: ({ children, ...props }) => (
                        <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto mb-6 text-sm" {...props}>
                          {children}
                        </pre>
                      ),
                      // Inline code with better styling
                      code: ({ children, className, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono text-slate-800 font-medium" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      // Enhanced table styling
                      table: ({ children, ...props }) => (
                        <div className="overflow-x-auto mb-6">
                          <table className="min-w-full border-collapse border border-slate-200 rounded-lg overflow-hidden" {...props}>
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children, ...props }) => (
                        <th className="border border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 font-text" {...props}>
                          {children}
                        </th>
                      ),
                      td: ({ children, ...props }) => (
                        <td className="border border-slate-200 px-4 py-3 text-slate-600" {...props}>
                          {children}
                        </td>
                      ),
                      // Enhanced blockquote
                      blockquote: ({ children, ...props }) => (
                        <blockquote className="border-l-4 border-blue-500 bg-blue-50/50 pl-4 py-2 mb-4 italic text-slate-700" {...props}>
                          {children}
                        </blockquote>
                      ),
                      // Custom link styling for external links
                      a: ({ href, children, ...props }) => {
                        const isExternal = href?.startsWith('http');
                        return (
                          <a
                            href={href}
                            className={`text-blue-600 hover:text-blue-700 ${
                              isExternal ? 'after:content-["↗"] after:ml-1 after:text-xs' : ''
                            }`}
                            {...(isExternal && {
                              target: '_blank',
                              rel: 'noopener noreferrer'
                            })}
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }
                    }}
                  >
                    {docContent.content}
                  </ReactMarkdown>
                </div>

                {/* Navigation Footer */}
                <div className="mt-16 pt-8 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      {prev && (
                        <Link href={`/docs/${prev.slug}`}>
                          <Button variant="outline" className="group">
                            <ChevronLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                            <div className="text-left">
                              <div className="text-xs text-slate-500">Previous</div>
                              <div className="font-medium">{prev.title}</div>
                            </div>
                          </Button>
                        </Link>
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      {next && (
                        <Link href={`/docs/${next.slug}`}>
                          <Button variant="outline" className="group">
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Next</div>
                              <div className="font-medium">{next.title}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
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
import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Terminal, 
  Code, 
  Settings, 
  Server, 
  Database, 
  HelpCircle,
  ExternalLink,
  ArrowRight
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation - SpeakEasy',
  description: 'Complete documentation for SpeakEasy text-to-speech service including CLI, SDK, configuration, and troubleshooting guides.',
};

const docSections = [
  {
    title: 'Getting Started',
    description: 'Quick start guides and installation',
    icon: BookOpen,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    docs: [
      {
        title: 'Overview & Quick Start',
        description: 'Installation, basic usage, and key concepts',
        href: '/docs/overview',
        badge: 'Start Here'
      }
    ]
  },
  {
    title: 'CLI Reference',
    description: 'Command-line interface documentation',
    icon: Terminal,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    docs: [
      {
        title: 'CLI Commands',
        description: 'Complete command-line reference with examples',
        href: '/docs/cli',
        badge: 'Essential'
      }
    ]
  },
  {
    title: 'SDK & API',
    description: 'TypeScript SDK and programmatic usage',
    icon: Code,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    docs: [
      {
        title: 'SDK Guide',
        description: 'TypeScript SDK usage, classes, and examples',
        href: '/docs/sdk',
        badge: 'Popular'
      }
    ]
  },
  {
    title: 'Configuration',
    description: 'Setup and customization options',
    icon: Settings,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    docs: [
      {
        title: 'Configuration Guide',
        description: 'Global config, environment variables, and settings',
        href: '/docs/configuration',
        badge: 'Important'
      }
    ]
  },
  {
    title: 'Providers',
    description: 'TTS provider setup and features',
    icon: Server,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    docs: [
      {
        title: 'Providers Guide',
        description: 'System, OpenAI, ElevenLabs, and Groq setup',
        href: '/docs/providers',
        badge: 'Detailed'
      }
    ]
  },
  {
    title: 'Cache System',
    description: 'Performance optimization and management',
    icon: Database,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    docs: [
      {
        title: 'Cache Guide',
        description: 'Cache management, analytics, and optimization',
        href: '/docs/cache',
        badge: 'Advanced'
      }
    ]
  },
  {
    title: 'Support',
    description: 'Troubleshooting and help',
    icon: HelpCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    docs: [
      {
        title: 'Troubleshooting',
        description: 'Common issues, solutions, and diagnostics',
        href: '/docs/troubleshooting',
        badge: 'Help'
      }
    ]
  }
];

const quickLinks = [
  {
    title: 'GitHub Repository',
    description: 'Source code and issues',
    href: 'https://github.com/arach/SpeakEasy',
    external: true
  },
  {
    title: 'NPM Package',
    description: '@arach/speakeasy',
    href: 'https://www.npmjs.com/package/@arach/speakeasy',
    external: true
  }
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                ← Back to Home
              </Link>
              <div className="h-4 w-px bg-slate-300" />
              <h1 className="text-2xl font-bold text-slate-900">Documentation</h1>
            </div>
            <Badge variant="outline" className="text-xs">
              Version 0.2.0
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Complete SpeakEasy Documentation
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Everything you need to integrate text-to-speech into your applications. 
            From CLI commands to SDK usage, configuration, and troubleshooting.
          </p>
        </div>

        {/* Documentation Sections */}
        <div className="grid gap-8 lg:gap-12">
          {docSections.map((section, index) => {
            const IconComponent = section.icon;
            return (
              <div key={section.title} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${section.bgColor}`}>
                    <IconComponent className={`w-5 h-5 ${section.color}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      {section.title}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {section.description}
                    </p>
                  </div>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.docs.map((doc) => (
                    <Link key={doc.href} href={doc.href}>
                      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base group-hover:text-blue-600 transition-colors">
                              {doc.title}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              {doc.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {doc.badge}
                                </Badge>
                              )}
                              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <CardDescription>
                            {doc.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Links */}
        <div className="mt-16 pt-8 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Quick Links</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className="group"
                {...(link.external && { target: '_blank', rel: 'noopener noreferrer' })}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                          {link.title}
                        </h4>
                        <p className="text-sm text-slate-600 mt-1">
                          {link.description}
                        </p>
                      </div>
                      {link.external ? (
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600">
            Need help? Start with the{' '}
            <Link href="/docs/troubleshooting" className="text-blue-600 hover:text-blue-700 font-medium">
              Troubleshooting Guide
            </Link>
            {' '}or run{' '}
            <code className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">
              speakeasy --doctor
            </code>
            {' '}for diagnostics.
          </p>
        </div>
      </div>
    </div>
  );
}
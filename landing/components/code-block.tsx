'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  children: string;
  className?: string;
  inline?: boolean;
}

export function CodeBlock({ children, className, inline }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  // Extract language from className (e.g., "language-typescript" -> "typescript")
  const language = className?.replace('language-', '') || 'text';
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  // For inline code, use simple styling
  if (inline || !className?.includes('language-')) {
    return (
      <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-800 font-medium">
        {children}
      </code>
    );
  }

  // For code blocks, use syntax highlighting with copy button
  return (
    <div className="relative group mb-4">
      <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
        {/* Header with language and copy button */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
          <span className="text-xs font-medium text-slate-600 uppercase">
            {language === 'text' ? 'code' : language}
          </span>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        </div>
        
        {/* Code content */}
        <div className="overflow-x-auto">
          <SyntaxHighlighter
            language={language}
            style={oneLight}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
              fontSize: '0.75rem',
              lineHeight: '1.5',
            }}
            showLineNumbers={false}
            wrapLines={false}
          >
            {children}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}
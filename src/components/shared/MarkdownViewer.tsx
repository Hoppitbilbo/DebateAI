/**
 * @file A component for rendering Markdown content with syntax highlighting.
 * @remarks This component uses `react-markdown` to parse and render Markdown, `remark-gfm` for GitHub Flavored Markdown support,
 * and `react-syntax-highlighter` for code block syntax highlighting.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * @interface MarkdownViewerProps
 * @description Defines the props for the MarkdownViewer component.
 * @property {string} content - The Markdown content to be rendered.
 * @property {string} [className] - Optional additional CSS classes for the root container.
 */
interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/**
 * @function MarkdownViewer
 * @description A component that safely renders Markdown text into HTML, with support for GFM tables and syntax-highlighted code blocks.
 * @param {MarkdownViewerProps} props - The props for the component.
 * @returns {JSX.Element} The rendered Markdown content.
 */
const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className = "" }) => {
  return (
    <div className={`prose dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={`bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800 ${className}`} {...props}>
                {children}
              </code>
            );
          },
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3 text-gray-800" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-4 mb-2 text-gray-800" {...props} />,
          p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
          ul: ({ node, ordered, ...props }) => <ul className="list-disc pl-5 mb-4 text-gray-700" {...props} />,
          ol: ({ node, ordered, ...props }) => <ol className="list-decimal pl-5 mb-4 text-gray-700" {...props} />,
          li: ({ node, ordered, ...props }) => <li className="mb-1 text-gray-700" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
          em: ({ node, ...props }) => <em className="italic text-gray-700" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-education/40 pl-4 italic my-4 text-gray-600 bg-gray-50 py-2 rounded-r" {...props} />
          ),
          table: ({ node, ...props }) => <table className="w-full border-collapse border border-gray-300 my-4" {...props} />,
          thead: ({ node, ...props }) => <thead className="bg-gray-100" {...props} />,
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => <tr className="border-b border-gray-300" {...props} />,
          th: ({ node, ...props }) => <th className="p-2 border-r border-gray-300 font-bold text-left" {...props} />,
          td: ({ node, ...props }) => <td className="p-2 border-r border-gray-300" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
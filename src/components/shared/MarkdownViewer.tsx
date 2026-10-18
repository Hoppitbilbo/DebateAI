import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className = "" }) => {
  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
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
              <code className={`bg-black/30 px-1 py-0.5 rounded text-sm font-mono text-primary ${className}`} {...props}>
                {children}
              </code>
            );
          },
          // Add styling for other markdown elements
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3 text-primary" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-4 mb-2 text-primary" {...props} />,
          p: ({ node, ...props }) => <p className="mb-3 last:mb-0 text-inherit leading-relaxed" {...props} />,
          ul: ({ node, ordered, ...props }) => <ul className="list-disc pl-5 mb-3 text-inherit" {...props} />,
          ol: ({ node, ordered, ...props }) => <ol className="list-decimal pl-5 mb-3 text-inherit" {...props} />,
          li: ({ node, ordered, ...props }) => <li className="mb-1 text-inherit" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-bold text-inherit" {...props} />,
          em: ({ node, ...props }) => <em className="italic text-inherit" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-education/40 pl-4 italic my-4 text-muted-foreground bg-black/20 py-2 rounded-r" {...props} />
          ),
          // Add table components for GFM
          table: ({ node, ...props }) => <table className="w-full border-collapse border border-border my-4" {...props} />,
          thead: ({ node, ...props }) => <thead className="bg-black/20" {...props} />,
          tbody: ({ node, ...props }) => <tbody {...props} />,
          tr: ({ node, ...props }) => <tr className="border-b border-border" {...props} />,
          th: ({ node, ...props }) => <th className="p-2 border-r border-border font-bold text-left" {...props} />,
          td: ({ node, ...props }) => <td className="p-2 border-r border-border" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;
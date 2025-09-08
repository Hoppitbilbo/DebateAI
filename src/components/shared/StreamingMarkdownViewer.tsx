/**
 * @file A component for rendering Markdown content with a streaming, typewriter-like effect.
 * @remarks This component extends the `MarkdownViewer` by displaying the content character by character
 * to simulate a streaming response from an AI.
 */

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * @interface StreamingMarkdownViewerProps
 * @description Defines the props for the StreamingMarkdownViewer component.
 * @property {string} content - The full Markdown content to be streamed.
 * @property {boolean} [isStreaming=false] - If true, the content is displayed with a typewriter effect. If false, it's displayed instantly.
 * @property {string} [className] - Optional additional CSS classes for the root container.
 */
interface StreamingMarkdownViewerProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * @function StreamingMarkdownViewer
 * @description A component that renders Markdown content with an optional streaming effect,
 * simulating a real-time response.
 * @param {StreamingMarkdownViewerProps} props - The props for the component.
 * @returns {JSX.Element} The rendered streaming Markdown viewer.
 */
const StreamingMarkdownViewer: React.FC<StreamingMarkdownViewerProps> = ({ 
  content, 
  isStreaming = false, 
  className = "" 
}) => {
  const [displayContent, setDisplayContent] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayContent(content);
      return;
    }

    if (currentIndex < content.length) {
      const timer = setTimeout(() => {
        setDisplayContent(content.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 20);

      return () => clearTimeout(timer);
    }
  }, [content, currentIndex, isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      setCurrentIndex(0);
      setDisplayContent('');
    }
  }, [content, isStreaming]);

  return (
    <div className={`markdown-viewer prose prose-slate max-w-none text-gray-900 ${className}`}>
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
        }}
      >
        {displayContent}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1" />
      )}
    </div>
  );
};

export default StreamingMarkdownViewer;

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface StreamingMarkdownViewerProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

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
      }, 20); // Adjust speed as needed

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
          // Add styling for other markdown elements
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

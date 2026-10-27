import { lazy, Suspense } from "react";

interface CodeBlockProps {
  children: string;
  language: string;
  className?: string;
}

const PlainCode = ({ children, className }: CodeBlockProps) => <code className={className}>{children}</code>;

const HighlightedCode = lazy(() => import("./HighlightedCode").catch((error: unknown) => {
  // Highlighting is optional: an offline chunk must never take down the conversation.
  console.error("Unable to load syntax highlighting; displaying plain code.", error);
  return { default: PlainCode };
}));

const CodeBlock = (props: CodeBlockProps) => (
  <Suspense fallback={<PlainCode {...props} />}>
    <HighlightedCode {...props} />
  </Suspense>
);

export default CodeBlock;

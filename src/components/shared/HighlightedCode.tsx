import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";

interface HighlightedCodeProps {
  children: string;
  language: string;
}

const HighlightedCode = ({ children, language }: HighlightedCodeProps) => (
  <SyntaxHighlighter style={vscDarkPlus} language={language} PreTag="div">
    {children}
  </SyntaxHighlighter>
);

export default HighlightedCode;

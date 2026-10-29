import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";

// Only the languages a school conversation is likely to show (the full
// Prism bundle is ~640 kB); any other language is shown as plain code.
const LANGUAGES = {
  bash, c, cpp, css, java, javascript, json, markdown, markup, python, sql, typescript,
  sh: bash, shell: bash, js: javascript, ts: typescript, html: markup, xml: markup, py: python, md: markdown,
};
for (const [name, grammar] of Object.entries(LANGUAGES)) SyntaxHighlighter.registerLanguage(name, grammar);

interface HighlightedCodeProps {
  children: string;
  language: string;
}

const HighlightedCode = ({ children, language }: HighlightedCodeProps) => (
  <SyntaxHighlighter style={vscDarkPlus} language={language in LANGUAGES ? language : "text"} PreTag="div">
    {children}
  </SyntaxHighlighter>
);

export default HighlightedCode;

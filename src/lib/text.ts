/**
 * The plain text of an HTML fragment, such as a Wikipedia search snippet:
 * tags dropped and entities decoded (&#039; → ', &quot; → ", &amp; → &).
 * The parser builds an inert document, so nothing in it runs or loads.
 */
export const htmlToText = (html: string): string =>
  html ? new DOMParser().parseFromString(html, "text/html").documentElement.textContent ?? "" : "";

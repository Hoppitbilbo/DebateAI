/**
 * @file A card component for displaying content, with support for loading states and Markdown rendering.
 * @remarks This component is used to display user reflections and AI feedback in a consistent card format.
 * It can show a skeleton loader while content is being fetched.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownViewer from './MarkdownViewer';

/**
 * @interface ReflectionDisplayCardProps
 * @description Defines the props for the ReflectionDisplayCard component.
 * @property {string} title - The title to be displayed in the card's header.
 * @property {string | null} [content] - The main content to be displayed. Can be a plain string or Markdown.
 * @property {boolean} [isLoading=false] - If true, a skeleton loader is displayed instead of the content.
 * @property {boolean} [renderAsHtml=false] - If true, the content is rendered as Markdown. Otherwise, it's rendered as plain text.
 * @property {string} [contentClassName] - Optional additional CSS classes for the content container.
 */
interface ReflectionDisplayCardProps {
  title: string;
  content?: string | null;
  isLoading?: boolean;
  renderAsHtml?: boolean;
  contentClassName?: string;
}

/**
 * @function ReflectionDisplayCard
 * @description A reusable card component for displaying textual content. It supports a loading state
 * and can render content as either plain text or formatted Markdown.
 * @param {ReflectionDisplayCardProps} props - The props for the component.
 * @returns {JSX.Element} The rendered display card.
 */
const ReflectionDisplayCard: React.FC<ReflectionDisplayCardProps> = ({
  title,
  content,
  isLoading = false,
  renderAsHtml = false,
  contentClassName = ""
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-education">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[80%]" />
          </div>
        ) : content ? (
          renderAsHtml ? (
            <MarkdownViewer content={content} className={contentClassName} />
          ) : (
            <div className={contentClassName}>{content}</div>
          )
        ) : (
          <p className="text-muted-foreground italic">Nessun contenuto disponibile.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ReflectionDisplayCard;

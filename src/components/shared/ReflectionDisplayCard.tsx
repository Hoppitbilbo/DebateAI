
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownViewer from './MarkdownViewer';

interface ReflectionDisplayCardProps {
  title: string;
  content?: string | null;
  isLoading?: boolean;
  renderAsHtml?: boolean;
  contentClassName?: string;
}

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

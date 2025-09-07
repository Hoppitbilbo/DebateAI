/**
 * @file A placeholder preview of your content before the data gets loaded to reduce load-time frustration.
 * @remarks This component is part of the `shadcn/ui` collection and is styled with `tailwindcss`.
 * It is used to indicate that content is loading.
 * @see https://ui.shadcn.com/docs/components/skeleton
 */

import { cn } from "@/lib/utils"

/**
 * @description A skeleton loader component to indicate loading status.
 * @param {React.HTMLAttributes<HTMLDivElement>} props - The props for the component.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

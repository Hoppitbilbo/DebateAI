/**
 * @file Displays a multi-line text input field.
 * @remarks This component is a styled HTML `<textarea>` element.
 * It is part of the `shadcn/ui` collection and is styled with `tailwindcss`.
 * @see https://ui.shadcn.com/docs/components/textarea
 */

import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * @description A multi-line text input component.
 * @param {TextareaProps} props - The props for the component, extending standard textarea attributes.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

/**
 * @file Displays an indicator showing the completion progress of a task.
 * @remarks This component is a wrapper around the `Progress` component from `radix-ui/react-progress`.
 * It is styled using `tailwindcss` and is part of the `shadcn/ui` collection.
 * @see https://www.radix-ui.com/primitives/docs/components/progress
 * @see https://ui.shadcn.com/docs/components/progress
 */

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

/**
 * @description A progress bar component that displays the completion status of a task.
 * @param {React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>} props - The props for the component.
 * @param {number} [props.value] - The current progress value, from 0 to 100.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

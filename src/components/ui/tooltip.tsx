/**
 * @file A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.
 * @remarks This component is a wrapper around the `Tooltip` component from `radix-ui/react-tooltip`.
 * It is styled using `tailwindcss` and is part of the `shadcn/ui` collection.
 * @see https://www.radix-ui.com/primitives/docs/components/tooltip
 * @see https://ui.shadcn.com/docs/components/tooltip
 */

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

/**
 * @description The provider for the tooltip component.
 */
const TooltipProvider = TooltipPrimitive.Provider

/**
 * @description The root component for the tooltip.
 */
const Tooltip = TooltipPrimitive.Root

/**
 * @description The trigger that opens the tooltip.
 */
const TooltipTrigger = TooltipPrimitive.Trigger

/**
 * @description The content of the tooltip.
 * @param {React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>} props - The props for the component.
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

/**
 * @file Displays rich content in a portal, triggered by a button.
 * @remarks This component is a wrapper around the `Popover` component from `radix-ui/react-popover`.
 * It is styled using `tailwindcss` and is part of the `shadcn/ui` collection.
 * @see https://www.radix-ui.com/primitives/docs/components/popover
 * @see https://ui.shadcn.com/docs/components/popover
 */

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

/**
 * @description The root component for a popover.
 * @param {React.ComponentProps<typeof PopoverPrimitive.Root>} props - The props for the component.
 */
const Popover = PopoverPrimitive.Root

/**
 * @description The button that triggers the popover to open.
 * @param {React.ComponentProps<typeof PopoverPrimitive.Trigger>} props - The props for the component.
 */
const PopoverTrigger = PopoverPrimitive.Trigger

/**
 * @description The content that is displayed within the popover.
 * @param {React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>} props - The props for the component.
 * @param {string} [props.align="center"] - The preferred alignment of the popover content to the trigger.
 * @param {number} [props.sideOffset=4] - The distance in pixels from the trigger to the popover content.
 */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }

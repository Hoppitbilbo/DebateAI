/**
 * @file Visually or semantically separates content.
 * @remarks This component is a wrapper around the `Separator` component from `radix-ui/react-separator`.
 * It is styled using `tailwindcss` and is part of the `shadcn/ui` collection.
 * @see https://www.radix-ui.com/primitives/docs/components/separator
 * @see https://ui.shadcn.com/docs/components/separator
 */

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

/**
 * @description A separator component to divide content.
 * @param {React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>} props - The props for the component.
 * @param {"horizontal" | "vertical"} [props.orientation="horizontal"] - The orientation of the separator.
 * @param {boolean} [props.decorative=true] - Whether the separator is for decoration or semantic separation.
 */
const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }

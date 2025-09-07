/**
 * @file An input where the user selects a value from within a given range.
 * @remarks This component is a wrapper around the `Slider` component from `radix-ui/react-slider`.
 * It is styled using `tailwindcss` and is part of the `shadcn/ui` collection.
 * @see https://www.radix-ui.com/primitives/docs/components/slider
 * @see https://ui.shadcn.com/docs/components/slider
 */

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

/**
 * @description A slider component that allows users to select a value from a range.
 * @param {React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>} props - The props for the component.
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }

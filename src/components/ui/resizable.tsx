/**
 * @file A set of components for creating resizable panel layouts.
 * @remarks This component is a wrapper around `react-resizable-panels`.
 * It is styled using `tailwindcss` and is part of the `shadcn/ui` collection.
 * @see https://github.com/bvaughn/react-resizable-panels
 * @see https://ui.shadcn.com/docs/components/resizable
 */

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

/**
 * @description A container for a group of resizable panels.
 * @param {React.ComponentProps<typeof ResizablePrimitive.PanelGroup>} props - The props for the component.
 */
const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

/**
 * @description A single panel within a resizable panel group.
 */
const ResizablePanel = ResizablePrimitive.Panel

/**
 * @description The handle used to resize the panels.
 * @param {React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & { withHandle?: boolean }} props - The props for the component.
 * @param {boolean} [props.withHandle] - Whether to display a visible grip handle.
 */
const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }

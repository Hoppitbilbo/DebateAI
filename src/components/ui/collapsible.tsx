/**
 * @file An interactive component which expands/collapses a content section.
 * @remarks This component is a wrapper around the `Collapsible` component from `radix-ui/react-collapsible`.
 * It is part of the `shadcn/ui` collection and is used to create hideable content sections.
 * @see https://www.radix-ui.com/primitives/docs/components/collapsible
 * @see https://ui.shadcn.com/docs/components/collapsible
 */

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }

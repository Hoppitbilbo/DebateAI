/**
 * @file An opinionated toast component for React.
 * @remarks This component is a wrapper around the `sonner` library, providing a styled toaster for notifications.
 * It is part of the `shadcn/ui` collection and integrates with the application's theme.
 * @see https://sonner.emilkowal.ski/
 * @see https://ui.shadcn.com/docs/components/sonner
 */

import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * @description A toaster component that displays toast notifications.
 * @param {ToasterProps} props - The props for the component, inherited from `sonner`.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }

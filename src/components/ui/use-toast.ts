/**
 * @file Re-exports the `useToast` hook and `toast` function.
 * @remarks This file is part of the `shadcn/ui` toast implementation and is used to expose the toast functionality
 * from the central `use-toast` hook. This is a legacy file and the new implementation uses `sonner`.
 * @see https://ui.shadcn.com/docs/components/toast
 */

import { useToast, toast } from "@/hooks/use-toast";

export { useToast, toast };

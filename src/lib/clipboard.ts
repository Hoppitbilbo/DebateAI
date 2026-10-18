import { toast } from "sonner";

/** Copies text and confirms with okMsg; if copying is not allowed, shows the text. */
export const copy = async (text: string, okMsg: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMsg);
  } catch {
    toast.error(text);
  }
};

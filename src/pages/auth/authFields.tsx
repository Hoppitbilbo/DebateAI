import React, { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Layout and fields shared by the auth pages (AuthPages, EnrollPage).

export const AuthLayout = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <Navbar />
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 text-card-foreground shadow-lg">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-bold text-primary">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
    <Footer />
  </div>
);

type FieldProps = { id: string; label: string; hint?: string; error?: string | null } & React.InputHTMLAttributes<HTMLInputElement>;

/** The ids of the hint and error under a field, for aria-describedby. */
const described = (id: string, hint?: string, error?: string | null) =>
  [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

const FieldNotes = ({ id, hint, error }: { id: string; hint?: string; error?: string | null }) => (
  <>
    {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
  </>
);

/** A labelled input, with an optional hint and error under it. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(({ id, label, hint, error, ...props }, ref) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} ref={ref} aria-invalid={error ? true : undefined} aria-describedby={described(id, hint, error)} {...props} />
    <FieldNotes id={id} hint={hint} error={error} />
  </div>
));
Field.displayName = "Field";

/** A password input with a button that shows or hides what was typed. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, "type">>(({ id, label, hint, error, ...props }, ref) => {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} ref={ref} type={shown ? "text" : "password"} className="pr-11" aria-invalid={error ? true : undefined}
          aria-describedby={described(id, hint, error)} autoCapitalize="none" spellCheck={false} {...props} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-controls={id} aria-pressed={shown}
          aria-label={shown ? t("platform.auth.hidePassword") : t("platform.auth.showPassword")}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
});
PasswordField.displayName = "PasswordField";

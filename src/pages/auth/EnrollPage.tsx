import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, User } from "@/lib/api";
import { authApi, ClassInvite } from "@/features/auth/authApi";
import { useJoinClass } from "@/features/student/studentApi";
import { dashboardPath, useAuth } from "@/context/auth";
import { useBusyAction } from "@/hooks/useBusyAction";
import i18n from "@/i18n";
import { AuthLayout, Field, PasswordField } from "./authFields";

// Page `/iscriviti?code=…`: a student creates an account without e-mail from
// the link of a username class, or (already logged in) joins the class with
// the account they have. Opening the link never enrolls or switches account
// by itself.

type InviteState = { kind: "loading" } | { kind: "ready"; invite: ClassInvite } | { kind: "invalid" } | { kind: "failed" };

/** The rules of the server (§2 of the plan), checked first to answer at once. */
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const passwordBytes = (p: string) => new TextEncoder().encode(p).length;

/** The text of a failed sign-up or join, in words a student understands. */
const enrollErrorText = (err: unknown, t: TFunction) => {
  if (err instanceof ApiError) {
    if (err.code === "username_taken") return t("platform.enroll.errors.taken");
    if (err.code === "server_unreachable") return t("platform.errors.server_unreachable");
    switch (err.status) {
      case 400: return t("platform.enroll.errors.invalid");
      case 403: return err.code === "disabled" ? t("platform.enroll.errors.closed") : t("platform.enroll.errors.guest");
      case 404: return t("platform.enroll.errors.link");
      case 429: return t("platform.errors.rate_limited");
      case 503: return t("platform.errors.unavailable");
    }
    return t("platform.errors.generic");
  }
  if (err instanceof TypeError) return t("platform.errors.network");
  return t("platform.errors.generic");
};

const ErrorBox = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{children}</p>
);

const EnrollPage = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const code = (params.get("code") || "").trim();
  const [state, setState] = useState<InviteState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The account just created: the confirmation stays even though a user is now logged in.
  const [created, setCreated] = useState<User | null>(null);

  useEffect(() => {
    if (!code) {
      setState({ kind: "invalid" });
      return;
    }
    let live = true;
    setState({ kind: "loading" });
    authApi.classInvite(code)
      .then((invite) => live && setState({ kind: "ready", invite }))
      .catch((err) => live && setState({ kind: err instanceof ApiError && err.status === 404 ? "invalid" : "failed" }));
    return () => { live = false; };
  }, [code, attempt]);

  if (created) return <Created user={created} />;
  if (state.kind === "loading" || loading) {
    return <AuthLayout title={t("platform.common.loading")}><Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden /></AuthLayout>;
  }
  if (state.kind === "invalid") {
    return (
      <AuthLayout title={t("platform.enroll.invalidTitle")}>
        <p className="text-center text-muted-foreground">{t("platform.enroll.invalidText")}</p>
        <Button asChild className="w-full"><Link to="/login">{t("platform.auth.login")}</Link></Button>
      </AuthLayout>
    );
  }
  if (state.kind === "failed") {
    return (
      <AuthLayout title={t("platform.enroll.failedTitle")}>
        <ErrorBox>{t("platform.errors.network")}</ErrorBox>
        <Button className="w-full" onClick={() => setAttempt((n) => n + 1)}>{t("platform.student.retry")}</Button>
      </AuthLayout>
    );
  }
  const className = state.invite.className;
  if (user) return <LoggedIn user={user} code={code} className={className} />;
  return <SignUpForm code={code} className={className} onCreated={setCreated} />;
};

/** The sign-up form: username and password, nothing else. */
const SignUpForm = ({ code, className, onCreated }: { code: string; className: string; onCreated: (u: User) => void }) => {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<{ field: "username" | "password"; text: string } | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { busy, run, error, clearError } = useBusyAction((e) => enrollErrorText(e, t), { inline: true });

  useEffect(() => {
    if (fieldError) (fieldError.field === "username" ? usernameRef : passwordRef).current?.focus();
  }, [fieldError]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    clearError();
    if (!USERNAME.test(name)) return setFieldError({ field: "username", text: t("platform.enroll.usernameHint") });
    if (password.length < 8 || passwordBytes(password) > 72) return setFieldError({ field: "password", text: t("platform.enroll.passwordHint") });
    setFieldError(null);
    void run(async () => {
      try {
        const u = await authApi.registerClass({ code, username: name, password, locale: i18n.language.slice(0, 2) });
        setUser(u);
        onCreated(u);
      } catch (err) {
        if (err instanceof ApiError && err.code === "username_taken") {
          setFieldError({ field: "username", text: t("platform.enroll.errors.taken") });
          return;
        }
        throw err;
      }
    });
  };

  const back = `/login?next=${encodeURIComponent(`/iscriviti?code=${encodeURIComponent(code)}`)}`;
  return (
    <AuthLayout title={t("platform.enroll.title", { className })} subtitle={t("platform.enroll.subtitle")}>
      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{t("platform.enroll.pseudonym")}</p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field ref={usernameRef} id="enroll-username" label={t("platform.enroll.username")} hint={t("platform.enroll.usernameHint")}
          error={fieldError?.field === "username" ? fieldError.text : null} type="text" name="username" autoComplete="username"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30} required value={username}
          onChange={(e) => { setUsername(e.target.value); if (fieldError?.field === "username") setFieldError(null); }} />
        <PasswordField ref={passwordRef} id="enroll-password" label={t("platform.auth.password")} hint={t("platform.enroll.passwordHint")}
          error={fieldError?.field === "password" ? fieldError.text : null} name="password" autoComplete="new-password" required value={password}
          onChange={(e) => { setPassword(e.target.value); if (fieldError?.field === "password") setFieldError(null); }} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />} {t("platform.enroll.submit")}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link to={back} className="text-primary hover:underline">{t("platform.enroll.haveAccount")}</Link>
      </p>
    </AuthLayout>
  );
};

/** Already logged in: join with this account, or log out first; never a second account by mistake. */
const LoggedIn = ({ user, code, className }: { user: User; code: string; className: string }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const joinClass = useJoinClass();
  const { busy, run, error } = useBusyAction((e) => enrollErrorText(e, t), { inline: true });
  const signOut = () => void run(logout);

  if (user.roomId) {
    return (
      <AuthLayout title={t("platform.enroll.title", { className })}>
        <p className="text-sm text-muted-foreground">{t("platform.enroll.guestText")}</p>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button className="w-full" variant="outline" onClick={signOut} disabled={busy}>{t("platform.enroll.guestLogout")}</Button>
      </AuthLayout>
    );
  }
  if (user.role !== "student") {
    return (
      <AuthLayout title={t("platform.enroll.title", { className })}>
        <p className="text-sm text-muted-foreground">{t("platform.enroll.staffText")}</p>
        <Button asChild className="w-full"><Link to={dashboardPath(user)}>{t("platform.nav.dashboard")}</Link></Button>
      </AuthLayout>
    );
  }
  const join = () => void run(async () => {
    const res = await joinClass(code);
    toast.success(t("platform.student.joined", { name: res.name }));
    navigate("/student", { replace: true });
  });
  return (
    <AuthLayout title={t("platform.enroll.title", { className })}>
      <p className="text-sm text-muted-foreground">{t("platform.enroll.loggedInText", { name: user.username || user.email || user.name })}</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="space-y-2">
        <Button className="w-full" onClick={join} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />} {t("platform.enroll.useMine")}
        </Button>
        <Button className="w-full" variant="outline" onClick={signOut} disabled={busy}>{t("platform.enroll.logoutAndCreate")}</Button>
      </div>
    </AuthLayout>
  );
};

/** After the sign-up: the username to write down and where to log in next time. */
const Created = ({ user }: { user: User }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  const loginUrl = `${window.location.origin}/login`;
  return (
    <AuthLayout title={t("platform.enroll.doneTitle")}>
      <div ref={box} tabIndex={-1} className="space-y-4 outline-none">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
        <p className="text-center">{t("platform.enroll.doneUsername")} <strong className="font-mono">{user.username}</strong></p>
        <p className="rounded-md bg-muted p-3 text-sm">{t("platform.enroll.doneNote")}</p>
        <p className="text-sm text-muted-foreground">{t("platform.enroll.doneLogin")} <span className="mt-1 block break-all font-mono">{loginUrl}</span></p>
      </div>
      <Button className="w-full" onClick={() => navigate("/student", { replace: true })}>{t("platform.enroll.goToClass")}</Button>
    </AuthLayout>
  );
};

export default EnrollPage;

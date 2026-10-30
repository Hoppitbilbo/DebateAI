import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTour } from "@/features/tour/tour";
import { apiErrorText } from "@/lib/apiErrorText";
import { loginName } from "@/lib/format";
import { internalPath } from "@/lib/internalPath";
import { authApi, InviteInfo, ProfileChange } from "@/features/auth/authApi";
import { dashboardPath, useAuth } from "@/context/auth";
import i18n from "@/i18n";
import { LOCALES } from "@/i18n/languages";
import { useBusyAction } from "@/hooks/useBusyAction";
import { AuthLayout, Field, PasswordField } from "./authFields";

/** useBusyAction with the auth error texts. */
const useAuthAction = () => {
  const { t } = useTranslation();
  return useBusyAction((err) => apiErrorText(err, t));
};

export const LoginPage = () => {
  const { t } = useTranslation();
  const { login, user, config } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const { busy, run } = useAuthAction();
  // Only a path of this site: an outside address would turn the login into a redirect.
  const next = internalPath(params.get("next"));

  if (config?.setupRequired) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to={next || dashboardPath(user)} replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const u = await login(identifier, password);
      navigate(next || dashboardPath(u), { replace: true });
    });
  };

  return (
    <AuthLayout title={t("platform.auth.loginTitle")} subtitle={t("platform.auth.loginSubtitle")}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="identifier" label={t("platform.auth.identifier")} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        <PasswordField id="password" label={t("platform.auth.password")} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("platform.auth.login")}
        </Button>
      </form>
      <div className="flex justify-between text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">{t("platform.auth.forgot")}</Link>
        <Link to="/apps" className="text-muted-foreground hover:underline">{t("platform.auth.continueAsGuest")}</Link>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("platform.auth.inviteOnly")}</p>
    </AuthLayout>
  );
};

export const RegisterPage = () => {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [locale, setLocale] = useState(i18n.language.slice(0, 2));
  const { busy, run } = useAuthAction();

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      return;
    }
    authApi.inviteInfo(token)
      .then((i) => {
        setInfo(i);
        if (i?.locale) {
          setLocale(i.locale);
          void i18n.changeLanguage(i.locale);
        }
      })
      .catch(() => setInvalid(true));
  }, [token]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!info?.userExists && password !== password2) {
      toast.error(t("platform.auth.passwordMismatch"));
      return;
    }
    void run(async () => {
      const u = await authApi.register({ token, name, password, locale });
      setUser(u);
      toast.success(t("platform.auth.registered"));
      navigate(dashboardPath(u), { replace: true });
    });
  };

  if (invalid) {
    return (
      <AuthLayout title={t("platform.auth.invalidInvite")}>
        <p className="text-center text-muted-foreground">{t("platform.auth.invalidInviteText")}</p>
        <Button asChild className="w-full"><Link to="/login">{t("platform.auth.login")}</Link></Button>
      </AuthLayout>
    );
  }
  if (!info) {
    return <AuthLayout title={t("platform.common.loading")}><Loader2 className="mx-auto h-6 w-6 animate-spin" /></AuthLayout>;
  }

  return (
    <AuthLayout
      title={t("platform.auth.registerTitle")}
      subtitle={t("platform.auth.registerSubtitle", { inviter: info.invitedBy, role: t(`platform.roles.${info.role}`), className: info.className || "-" })}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field id="email" label={t("platform.auth.email")} value={info.email} disabled readOnly />
        {info.userExists ? (
          <>
            <p className="text-sm text-muted-foreground">{t("platform.auth.existingAccount")}</p>
            <Field id="password" label={t("platform.auth.password")} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        ) : (
          <>
            <Field id="name" label={t("platform.auth.name")} required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <Field id="password" label={t("platform.auth.newPassword")} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <Field id="password2" label={t("platform.auth.repeatPassword")} type="password" minLength={8} required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
            <div className="space-y-2">
              <Label>{t("platform.auth.language")}</Label>
              <Select value={locale} onValueChange={(v) => { setLocale(v); void i18n.changeLanguage(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {info.userExists ? t("platform.auth.acceptInvite") : t("platform.auth.createAccount")}
        </Button>
      </form>
    </AuthLayout>
  );
};

export const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <AuthLayout title={t("platform.auth.forgotTitle")} subtitle={t("platform.auth.forgotSubtitle")}>
      {sent ? (
        <p className="text-center">{t("platform.auth.forgotSent")}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await authApi.forgotPassword(email);
            setSent(true);
          }}
        >
          <Field id="email" label={t("platform.auth.email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full">{t("platform.auth.sendLink")}</Button>
        </form>
      )}
      <Link to="/login" className="block text-center text-sm text-primary hover:underline">{t("platform.auth.backToLogin")}</Link>
    </AuthLayout>
  );
};

export const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const { busy, run } = useAuthAction();
  return (
    <AuthLayout title={t("platform.auth.resetTitle")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (password !== password2) return toast.error(t("platform.auth.passwordMismatch"));
          void run(async () => {
            const u = await authApi.resetPassword(params.get("token"), password);
            setUser(u);
            toast.success(t("platform.auth.passwordChanged"));
            navigate(dashboardPath(u), { replace: true });
          });
        }}
      >
        <Field id="password" label={t("platform.auth.newPassword")} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field id="password2" label={t("platform.auth.repeatPassword")} type="password" minLength={8} required value={password2} onChange={(e) => setPassword2(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>{t("platform.auth.savePassword")}</Button>
      </form>
    </AuthLayout>
  );
};

export const SetupPage = () => {
  const { t } = useTranslation();
  const { config, user, setUser, refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, run } = useAuthAction();
  if (config && !config.setupRequired && !busy) return <Navigate to={user ? "/admin?tab=ai" : "/login"} replace />;
  return (
    <AuthLayout title={t("platform.setup.title")} subtitle={t("platform.setup.subtitle")}>
      <div className="flex justify-center"><ShieldCheck className="h-10 w-10 text-primary" /></div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const u = await authApi.setup({ name, email, password, locale: i18n.language.slice(0, 2) });
            setUser(u);
            await refresh();
            navigate("/admin?tab=ai", { replace: true });
          });
        }}
      >
        <Field id="name" label={t("platform.auth.name")} required value={name} onChange={(e) => setName(e.target.value)} />
        <Field id="email" label={t("platform.auth.email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label={t("platform.auth.newPassword")} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>{t("platform.setup.create")}</Button>
      </form>
    </AuthLayout>
  );
};

export const AccountPage = () => {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const tour = useTour();
  const [name, setName] = useState(user?.name ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  if (!user) return <Navigate to="/login?next=/account" replace />;

  const save = async (change: ProfileChange, msg: string) => {
    try {
      // A new password also gives this browser a new session (the others end).
      const u = await authApi.updateProfile(change);
      setUser(u);
      toast.success(msg);
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error(apiErrorText(err, t));
    }
  };

  return (
    <AuthLayout title={t("platform.account.title")} subtitle={`${loginName(user)} · ${t(`platform.roles.${user.role}`)}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save({ name }, t("platform.common.saved")); }}>
        {/* An account without e-mail needs no real name: it is the name the class sees. */}
        {user.email
          ? <Field id="name" label={t("platform.auth.name")} value={name} onChange={(e) => setName(e.target.value)} />
          : <Field id="name" label={t("platform.account.displayName")} hint={t("platform.account.displayNameHint")} value={name} onChange={(e) => setName(e.target.value)} />}
        <div className="space-y-2">
          <Label>{t("platform.auth.language")}</Label>
          <Select value={user.locale} onValueChange={(v) => { void i18n.changeLanguage(v); void save({ locale: v }, t("platform.common.saved")); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full">{t("platform.common.save")}</Button>
      </form>
      <form className="space-y-4 border-t border-border pt-4" onSubmit={(e) => { e.preventDefault(); void save({ currentPassword: current, newPassword: next }, t("platform.auth.passwordChanged")); }}>
        {/* For password managers: which account the new password belongs to. */}
        <input type="text" name="username" autoComplete="username" value={loginName(user)} readOnly hidden />
        <PasswordField id="cur" label={t("platform.account.currentPassword")} autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordField id="new" label={t("platform.auth.newPassword")} autoComplete="new-password" minLength={8} maxLength={72} required value={next} onChange={(e) => setNext(e.target.value)} />
        <Button type="submit" variant="secondary" className="w-full">{t("platform.account.changePassword")}</Button>
      </form>
      <div className="space-y-3 border-t border-border pt-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">{t("platform.tour.common.settingsTitle")}</span>
            <span className="block text-xs text-muted-foreground">{t("platform.tour.common.settingsHint")}</span>
          </span>
          <Switch checked={tour.enabled} onCheckedChange={tour.setEnabled} />
        </label>
        <Button type="button" variant="outline" className="w-full" onClick={() => { tour.resetSeen(); toast.success(t("platform.tour.common.resetDone")); }}>
          {t("platform.tour.common.resetSeen")}
        </Button>
      </div>
    </AuthLayout>
  );
};

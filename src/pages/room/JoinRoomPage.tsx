import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { activityPath, ROOM_LIMITS, roomApi, RoomInfo } from "@/features/room/roomApi";
import { randomAvatar } from "@/features/room/avatars";
import AvatarPicker from "./AvatarPicker";

type Step = "code" | "profile" | "rejoin";

/** Error codes of the room API that have their own message. */
const KNOWN_ERRORS = ["not_found", "room_locked", "room_full", "nickname_taken", "bad_pin", "rate_limited"];

/**
 * Where students enter a room ("aula lampo"): the code the teacher shows,
 * then a nickname and an avatar. No e-mail, no password.
 */
const JoinRoomPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState((params.get("c") || "").toUpperCase());
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string>(randomAvatar);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) => {
    const c = e instanceof ApiError ? e.code : "";
    setError(t(`room.join.errors.${KNOWN_ERRORS.includes(c) ? c : "generic"}`));
  };

  const findRoom = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const found = await roomApi.lookup(value);
      if (found.locked) return setError(t("room.join.errors.room_locked"));
      if (found.full) return setError(t("room.join.errors.room_full"));
      setInfo(found);
      setStep("profile");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  // A QR code or link already carries the code.
  useEffect(() => {
    const fromLink = params.get("c");
    if (fromLink && fromLink.length >= 6) void findRoom(fromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user?.roomId) return <Navigate to="/aula" replace />;

  const enter = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = step === "rejoin"
        ? await roomApi.rejoin({ code, nickname, pin })
        : await roomApi.join({ code, nickname, avatar, locale: i18n.language });
      setUser(u);
      // Straight into the activity: everything the teacher fixed is already set.
      const room = await roomApi.myRoom().catch(() => null);
      navigate(room ? activityPath(room) : "/aula", { replace: true });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-center font-heading text-4xl font-bold">{t("room.join.title")}</h1>
        <p className="mt-2 text-center text-muted-foreground">{t("room.join.subtitle")}</p>

        {params.get("fine") && <p role="status" className="mt-6 rounded-md border border-border bg-secondary p-3 text-sm">{t("room.join.ended")}</p>}
        {user && !user.roomId && <p className="mt-6 rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900">{t("room.join.loggedInWarning", { name: user.name })}</p>}

        {step === "code" && (
          <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); void findRoom(code); }}>
            <Label htmlFor="room-code" className="sr-only">{t("room.join.codeLabel")}</Label>
            <Input
              id="room-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="K7MPQ2"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              className="h-16 text-center font-mono text-3xl tracking-[0.4em]"
              aria-describedby="room-code-hint"
            />
            <p id="room-code-hint" className="text-center text-sm text-muted-foreground">{t("room.join.codeHint")}</p>
            <Button type="submit" size="lg" className="w-full" disabled={code.length < 6 || busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}{t("room.join.next")}
            </Button>
          </form>
        )}

        {step !== "code" && (
          <form className="mt-8 space-y-6" onSubmit={enter}>
            {info && <p className="text-center text-sm">{t("room.join.roomTitle")} <strong>{info.title || t(`platform.appNames.${info.appType}`)}</strong> · <span className="font-mono">{code}</span></p>}
            <div className="space-y-2">
              <Label htmlFor="nickname">{t("room.join.nicknameLabel")}</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={ROOM_LIMITS.nickname} autoFocus autoComplete="off" className="h-12 text-lg" aria-describedby="nickname-hint" />
              <p id="nickname-hint" className="text-xs text-muted-foreground">{t("room.join.nicknameHint")}</p>
            </div>

            {step === "profile" ? (
              <AvatarPicker value={avatar} onChange={setAvatar} />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pin">{t("room.join.pinLabel")}</Label>
                <Input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" className="h-12 text-center font-mono text-2xl tracking-[0.5em]" />
                <p className="text-xs text-muted-foreground">{t("room.join.pinHint")}</p>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={busy || !nickname.trim() || (step === "rejoin" && pin.length < 4)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{step === "rejoin" ? t("room.join.rejoin") : t("room.join.enter")}
            </Button>
            <button type="button" className="mx-auto flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline" onClick={() => { setError(null); setStep(step === "rejoin" ? "profile" : "rejoin"); }}>
              <KeyRound className="h-4 w-4" />{step === "rejoin" ? t("room.join.newEntry") : t("room.join.alreadyInside")}
            </button>
          </form>
        )}

        {error && <p role="alert" className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          {t("room.join.privacy")} <Link to="/privacy" className="underline">{t("room.join.privacyLink")}</Link>
          <br />
          {t("room.join.avatarCredit")} <a href="https://icons8.com" target="_blank" rel="noopener noreferrer" className="underline">Icons8</a>
        </p>
      </main>
    </div>
  );
};

export default JoinRoomPage;

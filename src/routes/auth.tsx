import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Phone, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/jp/Navbar";
import { Button } from "@/components/jp/Button";
import { DEMO_OTP, formatPhone, normalizePhone, useAuth } from "@/lib/auth";

type Search = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search['redirect'] === "string" ? { redirect: search['redirect'] } : {},
  head: () => {
    const title = "Log in with your phone | JustPlay Kanpur";
    const description =
      "Sign in to JustPlay with your Indian mobile number and a 6-digit OTP to book sports venues in Kanpur.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: AuthPage,
});

const RESEND_SECONDS = 30;

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const { user, isAuthenticated, hydrated, requestOtp, verifyOtp, completeOnboarding } = useAuth();

  const [stage, setStage] = useState<"phone" | "otp" | "onboarding">("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const goNext = () => navigate({ to: redirect ?? "/", replace: true });

  useEffect(() => {
    if (hydrated && isAuthenticated && user?.name && stage !== "onboarding") goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isAuthenticated, user?.name]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async (isResend = false) => {
    const clean = normalizePhone(phone);
    if (clean.length !== 10) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setError(null);
    setBusy(true);
    await requestOtp(clean);
    setBusy(false);
    setCooldown(RESEND_SECONDS);
    if (!isResend) {
      setStage("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
    }
  };

  const setDigit = (i: number, value: string) => {
    const chars = value.replace(/\D/g, "");
    if (!chars) {
      setDigits((d) => d.map((v, idx) => (idx === i ? "" : v)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      chars.split("").forEach((c, k) => {
        if (i + k < 6) next[i + k] = c;
      });
      return next;
    });
    const focusIndex = Math.min(i + chars.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  const submitOtp = async () => {
    const code = digits.join("");
    setBusy(true);
    setError(null);
    try {
      const { isNewUser } = await verifyOtp(phone, code);
      if (isNewUser) {
        setStage("onboarding");
      } else {
        goNext();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitOnboarding = () => {
    if (name.trim().length < 2) {
      setError("Tell us your name so hosts know who's playing.");
      return;
    }
    completeOnboarding({ name, email });
    goNext();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="surface-card rounded-3xl p-6 sm:p-8">
          {stage === "phone" ? (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </span>
              <h1 className="mt-4 text-4xl leading-none">Chalo, khelte hain</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your mobile number. We'll send a one-time code — no passwords, ever.
              </p>

              <label htmlFor="phone" className="mt-6 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Mobile number
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
                <span className="text-sm font-bold text-muted-foreground">+91</span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                  className="h-12 w-full bg-transparent text-base font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground"
                />
              </div>
              {error ? <p className="mt-2 text-xs font-semibold text-destructive">{error}</p> : null}

              <Button className="mt-5 w-full" size="lg" onClick={() => sendOtp()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "Sending OTP…" : "Send OTP"}
              </Button>
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                By continuing you agree to JustPlay's Terms & Privacy Policy.
              </p>
            </>
          ) : null}

          {stage === "otp" ? (
            <>
              <button
                type="button"
                onClick={() => setStage("phone")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Change number
              </button>
              <h1 className="mt-4 text-4xl leading-none">Verify OTP</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                6-digit code sent to <span className="font-semibold text-foreground">{formatPhone(phone)}</span>
              </p>

              <div className="mt-6 flex justify-between gap-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    value={d}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={6}
                    aria-label={`OTP digit ${i + 1}`}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !digits[i] && i > 0) otpRefs.current[i - 1]?.focus();
                      if (e.key === "Enter") submitOtp();
                    }}
                    className="h-14 w-full rounded-xl border border-border bg-surface text-center font-display text-2xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                ))}
              </div>

              {error ? <p className="mt-3 text-xs font-semibold text-destructive">{error}</p> : null}

              <Button
                className="mt-5 w-full"
                size="lg"
                onClick={submitOtp}
                disabled={busy || digits.join("").length !== 6}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {busy ? "Verifying…" : "Verify & continue"}
              </Button>

              <div className="mt-4 text-center text-xs text-muted-foreground">
                {cooldown > 0 ? (
                  <span>Resend OTP in 00:{String(cooldown).padStart(2, "0")}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendOtp(true)}
                    className="font-bold text-primary hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-center text-[11px] text-muted-foreground">
                Demo mode — use <span className="font-bold text-foreground">{DEMO_OTP}</span> or any 6 digits.
              </p>
            </>
          ) : null}

          {stage === "onboarding" ? (
            <>
              <h1 className="text-4xl leading-none">Almost there</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Just your name — email is optional, for booking receipts.
              </p>

              <label htmlFor="name" className="mt-6 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Full name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shivang Dubey"
                className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-base font-semibold outline-none focus:border-primary"
              />

              <label htmlFor="email" className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Email <span className="font-medium normal-case">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-base font-semibold outline-none focus:border-primary"
              />

              {error ? <p className="mt-3 text-xs font-semibold text-destructive">{error}</p> : null}

              <Button className="mt-5 w-full" size="lg" onClick={submitOnboarding}>
                Start playing
              </Button>
            </>
          ) : null}
        </div>

        <Link
          to="/venues"
          className="mt-6 text-center text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          Browse venues without logging in
        </Link>
      </main>
    </div>
  );
}

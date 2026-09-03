import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  ChevronRight,
  CreditCard,
  Loader2,
  LogOut,
  Plus,
  Smartphone,
  Check,
} from "lucide-react";
import { Navbar } from "@/components/jp/Navbar";
import { Footer } from "@/components/jp/Footer";
import { Button } from "@/components/jp/Button";
import { useAuth, type NotificationPrefs } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => {
    const title = "Your JustPlay profile & settings";
    const description =
      "Manage your JustPlay account: name, email, saved UPI and cards, notification preferences, hosted games and groups.";
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
  component: ProfilePage,
});

const savedMethods = [
  { id: "pm1", type: "upi" as const, label: "shivang@okhdfcbank", meta: "Default · UPI" },
  { id: "pm2", type: "upi" as const, label: "9876543210@ybl", meta: "PhonePe UPI" },
  { id: "pm3", type: "card" as const, label: "HDFC Visa •••• 4412", meta: "Expires 08/29" },
];

const prefLabels: Array<{ key: keyof NotificationPrefs; title: string; desc: string }> = [
  { key: "bookingReminders", title: "Booking reminders", desc: "Nudge me 2 hours before my slot" },
  { key: "offers", title: "Offers & discounts", desc: "Weekend deals from Kanpur venues" },
  { key: "gameInvites", title: "Hosted game invites", desc: "When someone needs a player" },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, hydrated, prefs, setPrefs, updateProfile, logout } = useAuth();
  const { balance } = useWallet();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEmail(user?.email ?? "");
    setName(user?.name ?? "");
  }, [user?.email, user?.name]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 text-center">
          <h1 className="text-4xl leading-none">Log in to view your profile</h1>
          <Button
            className="mt-6"
            size="lg"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/profile" } })}
          >
            Log in with phone
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const save = () => {
    updateProfile({ name: name.trim() || user.name, email: email.trim() || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-4xl leading-none sm:text-5xl">Profile</h1>

        <section className="surface-card mt-6 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="gradient-primary flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl text-primary-foreground">
                {initials || "JP"}
              </span>
              <button
                type="button"
                aria-label="Upload profile photo"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-primary"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-2xl leading-none">{user.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">Member since 2026 · Kanpur</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pname"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                Name
              </label>
              <input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="pphone"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                Phone (login ID)
              </label>
              <input
                id="pphone"
                value={user.phone}
                readOnly
                className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-muted-foreground outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="pemail"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                Email
              </label>
              <input
                id="pemail"
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
              />
            </div>
          </div>

          <Button className="mt-4" size="sm" onClick={save}>
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : "Save changes"}
          </Button>
        </section>

        <section className="surface-card mt-5 rounded-2xl p-4 sm:p-5">
          <h2 className="text-2xl leading-none">Payment methods</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {savedMethods.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {m.type === "upi" ? (
                    <Smartphone className="h-4 w-4" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.label}</p>
                  <p className="text-[11px] text-muted-foreground">{m.meta}</p>
                </div>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-3">
            <Plus className="h-4 w-4" /> Add new
          </Button>
        </section>

        <section className="surface-card mt-5 rounded-2xl p-4 sm:p-5">
          <h2 className="text-2xl leading-none">Notifications</h2>
          <ul className="mt-4 divide-y divide-border">
            {prefLabels.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <Toggle
                  label={p.title}
                  checked={prefs[p.key]}
                  onChange={(v) => setPrefs({ [p.key]: v })}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card mt-5 rounded-2xl p-2">
          <Link
            to="/invite"
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-secondary"
          >
            <div>
              <p className="text-sm font-semibold">Invite & Rewards</p>
              <p className="text-xs text-muted-foreground">
                ₹{balance.toLocaleString("en-IN")} credit available
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/games"
            search={{ tab: "mine" }}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-secondary"
          >
            <div>
              <p className="text-sm font-semibold">My Hosted Games</p>
              <p className="text-xs text-muted-foreground">Games you organised</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/groups"
            search={{ tab: "mine" }}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-secondary"
          >
            <div>
              <p className="text-sm font-semibold">My Groups</p>
              <p className="text-xs text-muted-foreground">Crews you play with</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>

        <Button
          variant="outline"
          className="mt-6 w-full sm:w-auto"
          onClick={() => {
            logout();
            navigate({ to: "/", replace: true });
          }}
        >
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </main>

      <Footer />
    </div>
  );
}
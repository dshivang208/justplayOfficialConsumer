import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Gift,
  MessageCircle,
  Send,
  Share2,
  Ticket,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { EmptyState } from "@/components/jp/states";
import { useAuth } from "@/lib/auth";
import { useWallet, type ReferralStatus } from "@/lib/wallet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Invite Friends & Earn Rewards | JustPlay" },
      {
        name: "description",
        content:
          "Refer a friend to JustPlay and both of you get ₹100 off your next sports venue booking in Kanpur.",
      },
      { property: "og:title", content: "Invite Friends & Earn Rewards | JustPlay" },
      {
        property: "og:description",
        content: "Invite a friend, both get ₹100 off your next booking.",
      },
    ],
  }),
  component: InvitePage,
});

const howItWorks = [
  { icon: UserPlus, title: "Share your code", desc: "Send your referral link to a friend" },
  {
    icon: Ticket,
    title: "They book their first slot",
    desc: "Any venue, any sport, anywhere in Kanpur",
  },
  { icon: Gift, title: "Dono ko ₹100 off", desc: "Credit lands in both wallets instantly" },
];

const statusMeta: Record<ReferralStatus, { label: string; className: string }> = {
  invited: {
    label: "Invited",
    className: "border-border bg-surface text-muted-foreground",
  },
  joined: {
    label: "Joined",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  completed: {
    label: "Reward earned",
    className: "border-accent/40 bg-accent/10 text-accent",
  },
};

function InvitePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, hydrated } = useAuth();
  const { balance, referralCode, referrals, transactions } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!hydrated)
    return (
      <PageShell>
        <div />
      </PageShell>
    );

  if (!isAuthenticated || !user) {
    return (
      <PageShell>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-24 text-center">
          <h1 className="text-4xl leading-none">Log in to see your referral code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite friends and earn ₹100 credit every time one of them books their first slot.
          </p>
          <Button
            className="mt-6"
            size="lg"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/invite" } })}
          >
            Log in with phone
          </Button>
        </main>
      </PageShell>
    );
  }

  const shareLink = `https://justplay.app/r/${referralCode}`;
  const shareText = `Play sports in Kanpur with me on JustPlay! Use my code ${referralCode} and we both get ₹100 off — ${shareLink}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      /* clipboard unavailable — the visible link can still be copied manually */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareWhatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
  };

  const shareSms = () => {
    window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
  };

  const nativeShare = () => {
    if (navigator.share) {
      void navigator.share({ title: "Join me on JustPlay", text: shareText, url: shareLink });
    } else {
      void copyLink();
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Rewards"
        title="Invite Friends, Get Rewarded"
        subtitle="Every friend who plays their first game on JustPlay puts ₹100 in both your wallets."
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        {/* Referral code + share */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-surface p-6 sm:p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Your code</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-display text-4xl leading-none tracking-wide sm:text-5xl">
                {referralCode}
              </span>
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{shareLink}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="accent" onClick={shareWhatsapp}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button variant="outline" onClick={shareSms}>
                <Send className="h-4 w-4" /> SMS
              </Button>
              <Button variant="outline" onClick={nativeShare}>
                <Share2 className="h-4 w-4" /> More options
              </Button>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {howItWorks.map((s, i) => (
            <div key={s.title} className="surface-card rounded-2xl p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 text-sm font-bold">
                {String(i + 1).padStart(2, "0")}. {s.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Wallet balance */}
        <div className="mt-8 surface-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Reward wallet
                </p>
                <p className="font-display text-3xl leading-none">
                  ₹{balance.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
            <span className="hidden shrink-0 max-w-[14rem] text-right text-xs text-muted-foreground sm:block">
              Auto-applied as credit at checkout on your next booking
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground sm:hidden">
            Auto-applied as credit at checkout on your next booking.
          </p>

          {transactions.length > 0 ? (
            <ul className="mt-5 divide-y divide-border border-t border-border">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm text-muted-foreground">{t.label}</span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-bold",
                      t.amount >= 0 ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {t.amount >= 0 ? "+" : "-"}₹{Math.abs(t.amount).toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Friends invited */}
        <div className="mt-8">
          <h2 className="text-2xl leading-none">
            Friends Invited <span className="text-muted-foreground">({referrals.length})</span>
          </h2>

          <div className="mt-3">
            {referrals.length === 0 ? (
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="You haven't invited anyone yet"
                description="Share your code above to start earning."
              />
            ) : (
              <ul className="surface-card divide-y divide-border overflow-hidden rounded-2xl">
                {referrals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
                        {r.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.phone}</p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        statusMeta[r.status].className,
                      )}
                    >
                      {statusMeta[r.status].label}
                      {r.status === "completed" && r.rewardAmount ? ` · +₹${r.rewardAmount}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link to="/profile">Back to profile</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
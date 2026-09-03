import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ImagePlus, Lock, Users } from "lucide-react";
import { PageShell, PageHeader, Chip } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { sports, areas } from "@/data/landing";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import groupFootball from "@/assets/group-football.jpg";
import groupCricket from "@/assets/group-cricket.jpg";
import groupBadminton from "@/assets/group-badminton.jpg";
import venueBoxCricket from "@/assets/venue-boxcricket.jpg";
import venueTennis from "@/assets/venue-tennis.jpg";
import heroTurf from "@/assets/hero-turf.jpg";

const coverOptions = [
  groupFootball,
  groupCricket,
  groupBadminton,
  venueBoxCricket,
  venueTennis,
  heroTurf,
];

export const Route = createFileRoute("/groups/create")({
  head: () => ({
    meta: [{ title: "Create a Group | JustPlay" }],
  }),
  component: CreateGroupPage,
});

function CreateGroupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, hydrated } = useAuth();
  const { createGroup } = useCommunity();

  const [name, setName] = useState("");
  const [sport, setSport] = useState(sports[0]!.name);
  const [area, setArea] = useState(areas[0]!);
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"Public" | "Private">("Public");
  const [image, setImage] = useState(coverOptions[0]!);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (hydrated && !isAuthenticated) {
    return (
      <PageShell>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-24 text-center">
          <h1 className="text-4xl leading-none">Log in to create a group</h1>
          <Button
            className="mt-6"
            size="lg"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/groups/create" } })}
          >
            Log in with phone
          </Button>
        </main>
      </PageShell>
    );
  }

  const canSubmit = name.trim().length >= 3 && description.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const group = await createGroup({
        name: name.trim(),
        sport,
        description: description.trim(),
        area,
        privacy,
        image,
      });
      void navigate({ to: "/groups/$groupId", params: { groupId: group.id } });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not create this group. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Your people"
        title="Create a Group"
        subtitle="Start a crew, set the vibe, and invite players to join every week."
      />

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="surface-card space-y-6 rounded-2xl p-5 sm:p-6">
          <div>
            <label
              htmlFor="gname"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              Group name
            </label>
            <input
              id="gname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kalyanpur Sunday Strikers"
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Sport focus
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {sports.slice(0, 8).map((s) => (
                <Chip key={s.id} active={sport === s.name} onClick={() => setSport(s.name)}>
                  {s.emoji} {s.name}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Home area
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {areas.map((a) => (
                <Chip key={a} active={area === a} onClick={() => setArea(a)}>
                  {a}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="gdesc"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id="gdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What's the vibe? How often do you play, and who's welcome?"
              className="mt-1.5 w-full rounded-2xl border border-border bg-surface p-4 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <h2 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <ImagePlus className="h-3.5 w-3.5" /> Cover image
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Uploads aren't wired up yet — pick a placeholder cover for now.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {coverOptions.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImage(src)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                    image === src ? "border-primary" : "border-transparent hover:border-border",
                  )}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  {image === src ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
                      <Check className="h-5 w-5 text-on-image" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Privacy
            </h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { id: "Public", title: "Public", copy: "Anyone can find and join instantly." },
                  {
                    id: "Private",
                    title: "Private",
                    copy: "Shows a private badge. Access control coming later.",
                  },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPrivacy(o.id)}
                  className={cn(
                    "rounded-2xl border border-border bg-surface p-4 text-left transition-all",
                    privacy === o.id && "border-primary ring-1 ring-primary",
                  )}
                >
                  <p className="inline-flex items-center gap-1.5 font-semibold">
                    {o.id === "Private" ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Users className="h-3.5 w-3.5" />
                    )}
                    {o.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{o.copy}</p>
                </button>
              ))}
            </div>
          </div>

          <Button size="lg" className="w-full" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? "Creating…" : "Create Group"}
          </Button>
          {submitError ? (
            <p className="text-center text-xs font-semibold text-destructive">{submitError}</p>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
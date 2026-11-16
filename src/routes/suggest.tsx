import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lightbulb } from "lucide-react";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/suggest")({
  head: () => ({
    meta: [
      { title: "Suggest a Feature | JustPlay" },
      {
        name: "description",
        content: "Got an idea to make JustPlay better? Send us your suggestion.",
      },
    ],
  }),
  component: SuggestPage,
});

const CATEGORIES = [
  { id: "feature", label: "New feature" },
  { id: "venue", label: "Venue / sport" },
  { id: "booking", label: "Booking & payments" },
  { id: "app", label: "App experience" },
  { id: "other", label: "Other" },
] as const;

function SuggestPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("feature");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const nameError = name.trim().length === 0 ? "Your name is required." : null;
  const emailError =
    email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Enter a valid email address." : null;
  const messageError =
    message.trim().length < 10 ? "Please write at least 10 characters." : null;
  const canSubmit = !nameError && !emailError && !messageError;

  const submit = async () => {
    setAttempted(true);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("suggestions").insert({
        user_id: user?.id ?? null,
        name: name.trim(),
        email: email.trim() || null,
        category,
        message: message.trim(),
      });
      if (error) throw new Error(error.message);
      setSubmitted(true);
      setMessage("");
      toast.success("Suggestion sent — thank you!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your suggestion. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Your voice"
        title="Suggest a Feature"
        subtitle="Something missing? Something annoying? Tell us — we read every suggestion."
      />
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        {submitted ? (
          <div className="surface-card rounded-2xl p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Lightbulb className="h-6 w-6" />
            </span>
            <p className="mt-4 text-xl">Thanks — your suggestion is in.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Our team will review it. Have another idea?
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setSubmitted(false)}>
                Send another
              </Button>
              <Button asChild>
                <Link to="/">Back home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="surface-card space-y-5 rounded-2xl p-5 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            noValidate
          >
            <div>
              <p className="text-sm font-semibold">What is it about?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                      category === c.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/60",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className={field}
                  placeholder="Your name"
                />
                {attempted && nameError ? (
                  <span className="mt-1 block text-xs font-normal text-destructive">{nameError}</span>
                ) : null}
              </label>
              <label className="block text-sm font-semibold">
                Email <span className="font-normal text-muted-foreground">(optional)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={200}
                  className={field}
                  placeholder="you@example.com"
                />
                {attempted && emailError ? (
                  <span className="mt-1 block text-xs font-normal text-destructive">{emailError}</span>
                ) : null}
              </label>
            </div>

            <label className="block text-sm font-semibold">
              Your suggestion
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={6}
                className={field}
                placeholder="Describe your idea — what would you like to see, and why?"
              />
              <span className="mt-1 flex justify-between text-xs font-normal">
                <span className="text-destructive">{attempted ? messageError : ""}</span>
                <span className="text-muted-foreground">{message.length}/2000</span>
              </span>
            </label>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send suggestion"}
            </Button>
          </form>
        )}
      </div>
    </PageShell>
  );
}

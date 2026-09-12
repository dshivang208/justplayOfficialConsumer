import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Mail, MapPin, Phone } from "lucide-react";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us | JustPlay" },
      {
        name: "description",
        content:
          "Get in touch with the JustPlay team — questions, feedback, or venue partnerships.",
      },
    ],
  }),
  component: ContactPage,
});

const faqs = [
  {
    q: "How do I cancel a booking?",
    a: "Open Bookings from your profile, select the booking you want to cancel, and tap Cancel. Cancellation windows vary by venue — most allow a free cancellation up to a few hours before the slot, shown on the booking itself.",
  },
  {
    q: "How do refunds work?",
    a: "If a booking is eligible for cancellation, the amount is refunded to the original payment method via Razorpay. Refunds typically reflect in 5–7 business days depending on your bank.",
  },
  {
    q: "I hosted a game — how do I manage who's joined?",
    a: "Open the game from Hosted Games or your profile's \"Hosted by Me\" tab and tap Manage. From there you can approve or reject join requests, remove a player, edit the game details, or message everyone who's joined.",
  },
  {
    q: "Can I get a refund if I leave a hosted game?",
    a: "For free hosted games, leaving doesn't involve a refund. For split-cost games, refund handling depends on the host's own venue booking and how close to the game time you leave — message the host directly from the game page.",
  },
  {
    q: "How do I list my venue on JustPlay?",
    a: 'We\'re onboarding venue partners in Kanpur directly right now — reach out using the form on this page with "Venue partnership" in your message and our team will get in touch.',
  },
];

function ContactPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const nameError = name.trim().length === 0 ? "Your name is required." : null;
  const emailError = !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Enter a valid email address." : null;
  const messageError =
    message.trim().length < 10 ? "Message must be at least 10 characters." : null;
  const canSubmit = !nameError && !emailError && !messageError;

  const submit = async () => {
    setAttemptedSubmit(true);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("contact_submissions").insert({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        user_id: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      setSubmitted(true);
      setMessage("");
      toast.success("Message sent — we'll get back to you soon.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your message. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Get in touch"
        title="Contact Us"
        subtitle="Questions, feedback, or a venue you'd like to see on JustPlay — we'd love to hear from you."
      />

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h2 className="text-2xl leading-none">Send us a message</h2>

          {submitted ? (
            <div className="surface-card mt-5 rounded-2xl p-6 text-center">
              <p className="text-lg">Thanks — your message is in.</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Our team usually replies within 1–2 business days.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setSubmitted(false)}>
                Send another message
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="c-name" className="text-xs font-semibold text-muted-foreground">
                  Name
                </label>
                <input
                  id="c-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
                />
                {attemptedSubmit && nameError ? (
                  <p className="mt-1 text-xs font-semibold text-destructive">{nameError}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="c-email" className="text-xs font-semibold text-muted-foreground">
                  Email
                </label>
                <input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
                />
                {attemptedSubmit && emailError ? (
                  <p className="mt-1 text-xs font-semibold text-destructive">{emailError}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="c-message" className="text-xs font-semibold text-muted-foreground">
                  Message
                </label>
                <textarea
                  id="c-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="How can we help?"
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
                />
                {attemptedSubmit && messageError ? (
                  <p className="mt-1 text-xs font-semibold text-destructive">{messageError}</p>
                ) : null}
              </div>

              <Button size="lg" className="w-full" disabled={submitting} onClick={submit}>
                {submitting ? "Sending…" : "Send message"}
              </Button>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl leading-none">Reach us directly</h2>
          <div className="mt-5 space-y-3">
            <div className="surface-card flex items-center gap-3 rounded-xl p-4">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-semibold">support@justplay.in</p>
              </div>
            </div>
            <div className="surface-card flex items-center gap-3 rounded-xl p-4">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-semibold">+91 00000 00000</p>
              </div>
            </div>
            <div className="surface-card flex items-center gap-3 rounded-xl p-4">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Based in</p>
                <p className="text-sm font-semibold">Kanpur, Uttar Pradesh, India</p>
              </div>
            </div>
          </div>

          <h2 className="mt-10 text-2xl leading-none">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-4">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>
    </PageShell>
  );
}
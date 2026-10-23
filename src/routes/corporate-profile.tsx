import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Building2, CheckCircle2, FileText, Loader2, Trash2 } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { useAuth } from "@/lib/auth";
import {
  deleteCorporateProfile,
  fetchCorporateProfile,
  gstinError,
  saveCorporateProfile,
  type CorporateProfile,
} from "@/lib/corporateProfile";

export const Route = createFileRoute("/corporate-profile")({
  head: () => ({
    meta: [{ title: "Corporate Profile | JustPlay" }, { name: "robots", content: "noindex" }],
  }),
  component: CorporateProfilePage,
});

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary";

function CorporateProfilePage() {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<CorporateProfile | null>(null);
  const [gst, setGst] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let active = true;
    void fetchCorporateProfile().then((p) => {
      if (!active) return;
      setSaved(p);
      if (p) {
        setGst(p.gstNumber);
        setCompany(p.companyName);
        setAddress(p.companyAddress);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, userId]);

  const gstErr = gstinError(gst);
  const companyErr = company.trim().length < 2 ? "Enter the registered company name." : null;
  const addressErr = address.trim().length < 5 ? "Enter the registered company address." : null;
  const dirty =
    !saved ||
    saved.gstNumber !== gst.trim().toUpperCase() ||
    saved.companyName !== company.trim() ||
    saved.companyAddress !== address.trim();

  const submit = async () => {
    setAttempted(true);
    if (gstErr || companyErr || addressErr) return;
    setBusy(true);
    try {
      await saveCorporateProfile({
        gstNumber: gst.trim().toUpperCase(),
        companyName: company.trim(),
        companyAddress: address.trim(),
      });
      const fresh = await fetchCorporateProfile();
      setSaved(fresh);
      toast.success("Corporate profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteCorporateProfile();
      setSaved(null);
      setGst("");
      setCompany("");
      setAddress("");
      setAttempted(false);
      toast.success("Corporate profile removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove it.");
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Sign in to manage your corporate profile.</p>
          <Button asChild className="mt-4">
            <Link to="/auth" search={{ redirect: "/corporate-profile" }}>
              Sign in
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Profile
        </Link>

        <header className="mt-4 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl leading-none">Corporate Profile</h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Booking for your company? Save your business details for GST invoices.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <section className="surface-card mt-6 rounded-2xl p-5 sm:p-6">
            {saved ? (
              <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </p>
            ) : null}
            <div className="space-y-4">
              <Field id="cp-gst" label="Registered GST Number" error={attempted ? gstErr : null}>
                <input
                  id="cp-gst"
                  value={gst}
                  maxLength={15}
                  autoCapitalize="characters"
                  onChange={(e) => setGst(e.target.value.toUpperCase())}
                  placeholder="e.g. 09ABCDE1234F1Z5"
                  className={`${inputCls} h-11 uppercase tracking-wider`}
                />
              </Field>
              <Field id="cp-company" label="Registered Company Name" error={attempted ? companyErr : null}>
                <input
                  id="cp-company"
                  value={company}
                  maxLength={120}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="As on your GST certificate"
                  className={`${inputCls} h-11`}
                />
              </Field>
              <Field id="cp-address" label="Registered Company Address" error={attempted ? addressErr : null}>
                <textarea
                  id="cp-address"
                  value={address}
                  rows={3}
                  maxLength={300}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Building, street, city, state, PIN"
                  className={`${inputCls} resize-none py-2.5`}
                />
              </Field>
            </div>

            <Button
              size="lg"
              className="mt-6 w-full"
              disabled={busy || (Boolean(saved) && !dirty)}
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : saved ? "Update" : "Save"}
            </Button>

            {saved ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove corporate profile
              </button>
            ) : null}
          </section>
        )}

        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          GST invoices are issued directly by the venue you book with. Your details are private to
          your account.
        </p>
      </div>
    </PageShell>
  );
}

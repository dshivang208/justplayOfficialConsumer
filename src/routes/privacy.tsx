import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { LegalPlaceholderNotice, LegalSection } from "@/components/jp/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | JustPlay" },
      {
        name: "description",
        content: "How JustPlay collects, uses, and protects your information.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Legal" title="Privacy Policy" subtitle="Last updated: September 2026" />

      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <LegalPlaceholderNotice />

        <p className="mt-8 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          This Privacy Policy explains how JustPlay Sports Pvt. Ltd. ("JustPlay", "we", "us", or
          "our") collects, uses, discloses, and safeguards your information when you use our website
          and mobile application (together, the "Platform") to book sports venues, host or join
          games, and connect with sports communities in Kanpur.
        </p>

        <LegalSection number={1} title="Information We Collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-semibold text-foreground">Account information:</span> your name,
              phone number, email address, and profile photo when you create a JustPlay account.
            </li>
            <li>
              <span className="font-semibold text-foreground">Booking and activity data:</span>{" "}
              venues booked, slots reserved, games hosted or joined, and groups you're part of.
            </li>
            <li>
              <span className="font-semibold text-foreground">Payment information:</span> payments
              are processed by our third-party payment processor (Razorpay); we do not store your
              full card, UPI, or bank details on our own servers.
            </li>
            <li>
              <span className="font-semibold text-foreground">Location data:</span> approximate
              location, if you allow it, to show venues and games near you.
            </li>
            <li>
              <span className="font-semibold text-foreground">Device and usage data:</span> device
              type, app version, and how you interact with the Platform, for reliability and product
              improvement.
            </li>
          </ul>
        </LegalSection>

        <LegalSection number={2} title="How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Create and maintain your account, and process venue bookings and payments.</li>
            <li>Show you relevant venues, hosted games, and groups near your location.</li>
            <li>
              Enable communication between hosts and joined players for a game or group you're part
              of.
            </li>
            <li>Send booking confirmations, reminders, and important account or safety notices.</li>
            <li>Investigate and prevent fraud, abuse, or violations of our Terms & Conditions.</li>
            <li>Improve and troubleshoot the Platform.</li>
          </ul>
        </LegalSection>

        <LegalSection number={3} title="Third-Party Sharing">
          <p>
            We do not sell your personal information. We share information only with the following
            categories of third parties, and only as needed to operate the Platform:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <span className="font-semibold text-foreground">Payment processors</span> (such as
              Razorpay) to process bookings and refunds securely.
            </li>
            <li>
              <span className="font-semibold text-foreground">Venue partners</span>, who receive the
              booking details (name, time slot, contact number) needed to honour your reservation.
            </li>
            <li>
              <span className="font-semibold text-foreground">Other players</span> in a hosted game
              or group you join, limited to your name, profile photo, and participation status —
              never your phone number or payment details.
            </li>
            <li>
              <span className="font-semibold text-foreground">Service providers</span> who help us
              run the Platform (hosting, analytics, customer support tooling), bound by
              confidentiality obligations.
            </li>
            <li>
              <span className="font-semibold text-foreground">Law enforcement or regulators</span>,
              where required by applicable Indian law.
            </li>
          </ul>
        </LegalSection>

        <LegalSection number={4} title="Data Retention">
          <p>
            We retain your account and booking information for as long as your account is active,
            and for a reasonable period afterward as needed to resolve disputes, enforce our
            agreements, and comply with legal and tax obligations under Indian law. You may request
            deletion of your account as described in "Your Rights" below.
          </p>
        </LegalSection>

        <LegalSection number={5} title="Your Rights">
          <p>Subject to applicable law, you have the right to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Access and review the personal information we hold about you.</li>
            <li>Request correction of inaccurate or incomplete information.</li>
            <li>Request deletion of your account and associated personal information.</li>
            <li>Withdraw consent for location access or notifications at any time.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us using the details in "Contact Us for Privacy
            Concerns" below.
          </p>
        </LegalSection>

        <LegalSection number={6} title="Cookies and Similar Technologies">
          <p>
            We use cookies and similar technologies on our website to keep you signed in, remember
            your preferences, and understand how the Platform is used. You can control cookies
            through your browser settings; disabling them may affect some Platform features.
          </p>
        </LegalSection>

        <LegalSection number={7} title="Children's Privacy">
          <p>
            The Platform is not directed at children under 18. We do not knowingly collect personal
            information from children. If you believe a child has provided us information, please
            contact us and we will take steps to remove it.
          </p>
        </LegalSection>

        <LegalSection number={8} title="Data Security">
          <p>
            We use reasonable technical and organisational safeguards to protect your information.
            No method of transmission or storage is completely secure, and we cannot guarantee
            absolute security.
          </p>
        </LegalSection>

        <LegalSection number={9} title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be notified
            through the Platform or via email before they take effect. Continued use of the Platform
            after an update constitutes acceptance of the revised policy.
          </p>
        </LegalSection>

        <LegalSection number={10} title="Contact Us for Privacy Concerns">
          <p>
            If you have questions or concerns about this Privacy Policy or how your information is
            handled, reach out via our{" "}
            <Link to="/contact" className="font-semibold text-primary hover:underline">
              Contact page
            </Link>{" "}
            or email us directly at{" "}
            <span className="font-semibold text-foreground">privacy@justplay.in</span>.
          </p>
        </LegalSection>
      </div>
    </PageShell>
  );
}
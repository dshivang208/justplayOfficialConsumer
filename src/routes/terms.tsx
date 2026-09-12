import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { LegalPlaceholderNotice, LegalSection } from "@/components/jp/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions | JustPlay" },
      { name: "description", content: "The terms that govern your use of the JustPlay platform." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Legal"
        title="Terms & Conditions"
        subtitle="Last updated: September 2026"
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <LegalPlaceholderNotice />

        <p className="mt-8 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          These Terms & Conditions ("Terms") govern your access to and use of the JustPlay website
          and mobile application (the "Platform"), operated by JustPlay Sports Pvt. Ltd.
          ("JustPlay", "we", "us"). By creating an account or using the Platform, you agree to these
          Terms.
        </p>

        <LegalSection number={1} title="Acceptance of Terms">
          <p>
            By accessing or using the Platform, you confirm that you are at least 18 years old (or
            using the Platform under the supervision of a parent or guardian who agrees to these
            Terms on your behalf) and that you agree to be bound by these Terms and our Privacy
            Policy. If you do not agree, please do not use the Platform.
          </p>
        </LegalSection>

        <LegalSection number={2} title="Your Account">
          <p>You agree to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Provide accurate, current information when creating your account.</li>
            <li>Keep your login credentials confidential and notify us of any unauthorised use.</li>
            <li>Be responsible for all activity that occurs under your account.</li>
            <li>
              Use the Platform only for lawful purposes and in accordance with these Terms and any
              venue-specific rules.
            </li>
          </ul>
        </LegalSection>

        <LegalSection number={3} title="Booking & Cancellation Policy">
          <p>
            Venue bookings made through JustPlay are subject to the specific venue's availability,
            pricing, and cancellation window, shown at the time of booking. In general:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              A booking is confirmed once payment is successfully processed and you receive a
              confirmation on the Platform.
            </li>
            <li>
              Cancellations made within the venue's stated free-cancellation window are eligible for
              a full refund; cancellations after that window may be subject to a partial or no
              refund, at the venue's discretion.
            </li>
            <li>
              JustPlay reserves the right to cancel a booking (with a full refund) in cases of venue
              unavailability, safety concerns, or suspected fraudulent activity.
            </li>
            <li>
              Repeated no-shows or late cancellations may affect your ability to make future
              bookings on the Platform.
            </li>
          </ul>
        </LegalSection>

        <LegalSection number={4} title="Hosted Games & Community Conduct">
          <p>
            JustPlay allows users to host games at booked venues and invite other players to join,
            and to participate in sports groups. When hosting or joining a game or group, you agree
            to:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Show up on time for games you've joined, or cancel with reasonable notice.</li>
            <li>
              Treat other players, hosts, and venue staff with respect — harassment, discrimination,
              or abusive behaviour is not tolerated and may result in account suspension.
            </li>
            <li>
              As a host, accurately represent the game's cost, skill level, and total spots, and
              handle any cost-splitting with joined players fairly and transparently.
            </li>
            <li>
              Understand that JustPlay facilitates introductions between players but is not a party
              to, and does not guarantee the conduct of, any individual host or player.
            </li>
          </ul>
        </LegalSection>

        <LegalSection number={5} title="Payments">
          <p>
            Payments on the Platform are processed through Razorpay, a licensed third-party payment
            gateway. JustPlay does not store your full card, UPI, or banking credentials. Prices
            shown on the Platform are inclusive of applicable taxes unless stated otherwise.
            Refunds, where applicable under our cancellation policy, are issued to the original
            payment method.
          </p>
        </LegalSection>

        <LegalSection number={6} title="Prohibited Conduct">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Use the Platform for any unlawful purpose or to violate any applicable law.</li>
            <li>Impersonate another person or misrepresent your affiliation with anyone.</li>
            <li>Interfere with or disrupt the Platform's operation or security.</li>
            <li>
              Use the Platform to harass, threaten, or discriminate against any other user or venue
              partner.
            </li>
            <li>Attempt to circumvent JustPlay's booking or payment systems.</li>
          </ul>
        </LegalSection>

        <LegalSection number={7} title="Intellectual Property">
          <p>
            The Platform, including its design, logos, and content (excluding user-submitted
            content), is owned by JustPlay Sports Pvt. Ltd. and protected by applicable intellectual
            property laws. You may not copy, modify, or redistribute any part of the Platform
            without our written permission.
          </p>
        </LegalSection>

        <LegalSection number={8} title="Limitation of Liability">
          <p>
            The Platform is provided on an "as is" and "as available" basis. To the maximum extent
            permitted by applicable Indian law, JustPlay shall not be liable for any indirect,
            incidental, or consequential damages arising from your use of the Platform, including
            but not limited to injuries sustained while playing at a booked venue or during a hosted
            game, disputes between users, or venue-related issues outside our direct control. Our
            total liability for any claim arising from your use of the Platform shall not exceed the
            amount you paid to JustPlay in the three months preceding the claim.
          </p>
        </LegalSection>

        <LegalSection number={9} title="Indemnification">
          <p>
            You agree to indemnify and hold JustPlay harmless from any claims, damages, or expenses
            arising from your violation of these Terms, your misuse of the Platform, or your conduct
            toward other users or venue partners.
          </p>
        </LegalSection>

        <LegalSection number={10} title="Governing Law & Jurisdiction">
          <p>
            These Terms are governed by the laws of India. Any disputes arising out of or relating
            to these Terms or your use of the Platform shall be subject to the exclusive
            jurisdiction of the courts in Kanpur, Uttar Pradesh, India.
          </p>
        </LegalSection>

        <LegalSection number={11} title="Changes to These Terms">
          <p>
            We may revise these Terms from time to time. We'll notify you of material changes
            through the Platform or via email before they take effect. Continuing to use the
            Platform after a revised version takes effect constitutes your acceptance of the new
            Terms.
          </p>
        </LegalSection>

        <LegalSection number={12} title="Contact">
          <p>
            Questions about these Terms can be sent through our{" "}
            <Link to="/contact" className="font-semibold text-primary hover:underline">
              Contact page
            </Link>{" "}
            or to <span className="font-semibold text-foreground">legal@justplay.in</span>.
          </p>
        </LegalSection>
      </div>
    </PageShell>
  );
}
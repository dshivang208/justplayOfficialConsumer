import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/jp/Navbar";
import { Hero } from "@/components/jp/Hero";
import { SportsSection } from "@/components/jp/SportsSection";
import { VenuesSection } from "@/components/jp/VenuesSection";
import { HostGameSection } from "@/components/jp/HostGameSection";
import { HostedGamesSection } from "@/components/jp/HostedGamesSection";
import { GroupsSection } from "@/components/jp/GroupsSection";
import { EventsSection } from "@/components/jp/EventsSection";
import { ReferralSection } from "@/components/jp/ReferralSection";
import { Footer } from "@/components/jp/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JustPlay Kanpur — Book Sports Venues & Host Games" },
      {
        name: "description",
        content:
          "Book turfs and courts in Kanpur, host your own game, join local sports groups and tournaments. Kanpur ka apna sports network.",
      },
      { property: "og:title", content: "JustPlay Kanpur — Book Sports Venues & Host Games" },
      {
        property: "og:description",
        content:
          "Book turfs and courts across Kanpur, host games, and find players who show up.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <SportsSection />
        <VenuesSection />
        <HostGameSection />
        <HostedGamesSection />
        <GroupsSection />
        <EventsSection />
        <ReferralSection />
      </main>
      <Footer />
    </div>
  );
}

# JustPlay Kanpur

Build a modern, responsive web app for JustPlay — a sports venue booking + community platform for Kanpur, India, competing with Hudle/Playo. This is the CONSUMER-facing web app only (not partner/admin).

## IMPORTANT: Build in phases, one at a time

Do NOT build all pages at once. Follow this exact sequence:

PHASE 1: Build ONLY the Landing Page first (all sections listed below). Stop after this and show me the result before continuing.

PHASE 2: Once approved, build the Venue Discovery + Booking Flow.

PHASE 3: Once approved, build My Bookings + Profile + Auth.

PHASE 4: Once approved, build Host a Game flow, Groups, and Events full pages (landing page only teases these — full functionality comes here).

PHASE 5: Once approved, build Invite & Rewards full flow.

Wait for my confirmation after each phase before moving to the next. Do not skip ahead.

## Design Direction

- Dark, premium "sports elite" aesthetic — not a generic light SaaS template

- Primary dark background (near-black/charcoal), high-contrast accent color (electric green or amber for CTAs/availability states)

- Bold sporty typography for headings, clean sans-serif for body

- Card-based layouts with strong imagery emphasis

- Feel: premium, energetic, community-driven — not cluttered or "startup MVP" looking

## PHASE 1 SCOPE: Landing Page Sections (in this order, top to bottom)

1. **Hero Section**

   - City selector (Kanpur only for now, UI ready to expand)

   - Search bar: sport type, area, date

   - Strong CTA: "Find a Venue" / "Host a Game"

2. **Sports You Love**

   - Horizontal scrollable/grid of sport icons (cricket, football, badminton, tennis, box cricket, pickleball etc.)

   - Clicking a sport filters/teases relevant venues (link only for now, full filter logic in Phase 2)

3. **Venues Near You**

   - Grid of venue cards (photo, name, sport tags, price range, distance) — mock data

   - "View All Venues" CTA linking to discovery page (built in Phase 2)

4. **Host a Game**

   - Section explaining the feature: user can host a game at a venue and invite others to join/fill spots

   - CTA: "Host a Game" (button only for now, full flow built in Phase 4)

   - Visual: show example "hosted game" card (venue, sport, time, spots filled e.g. "6/10 joined")

5. **Hosted Games Near You**

   - Grid/list of mock hosted games happening nearby (sport, venue, time, host name, spots available, "Join" button)

   - This is the community/social discovery layer — distinct from direct venue booking

6. **Groups**

   - Section teasing sports groups/communities (e.g. "Kanpur Football Circle", "Weekend Warriors Cricket")

   - Show 3-4 mock group cards (name, member count, sport, cover image)

   - CTA: "Explore Groups" (full functionality in Phase 4)

7. **Events**

   - Section for tournaments/community events (e.g. local tournaments, coaching camps)

   - 3-4 mock event cards (title, date, venue, sport, "Register Interest" CTA)

   - Full event pages built in Phase 4

8. **Invite Friends, Get Rewarded**

   - Section explaining referral program (e.g. "Invite a friend, both get ₹100 off your next booking")

   - Simple CTA: "Invite Friends" (full flow with referral codes/tracking built in Phase 5)

9. **Footer**

   - Standard footer: About, Contact, Social links, City expansion teaser ("Coming soon to more cities")

## Technical Requirements

- Fully responsive, mobile-first (most Indian users on phone browsers) but must look great on desktop

- Component-driven — each landing section should be its own reusable component

- Use placeholder/mock JSON data everywhere in Phase 1 — structure it cleanly for easy API swap later

- Include loading and empty states for future data-driven sections

## Tone/Copy

- Hindi-English mix fine for CTAs where natural ("Host Karo", "Book Karo", "Slot Confirm Karein") — keep core UI/labels in English

- Confident, energetic, community-first tone — this should feel like a place people want to belong to, not just a booking utility

## What NOT to build in Phase 1

- No functional booking flow yet (venue cards/CTAs can link to placeholder pages)

- No functional auth/login yet

- No partner/admin panel

- No real payment integration

- No fully built-out Groups/Events/Host-a-Game pages — landing page teasers only in this phase

Build Phase 1 (Landing Page) now, then stop and wait for my review before continuing to Phase 2.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3454e439-2c91-4921-a947-3604d7e99609).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

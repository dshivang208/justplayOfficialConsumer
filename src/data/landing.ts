/**
 * Mock data for the JustPlay landing page.
 * Shapes mirror the future API contract so these can be swapped for
 * real fetches without touching component code.
 */

import venueBoxCricket from "@/assets/venue-boxcricket.jpg";
import venueBadminton from "@/assets/venue-badminton.jpg";
import venueTennis from "@/assets/venue-tennis.jpg";
import groupFootball from "@/assets/group-football.jpg";
import groupCricket from "@/assets/group-cricket.jpg";
import groupBadminton from "@/assets/group-badminton.jpg";
import eventTournament from "@/assets/event-tournament.jpg";

export type City = { id: string; name: string; state: string; live: boolean };

export type Sport = { id: string; name: string; emoji: string; venueCount: number };

export type Venue = {
  id: string;
  name: string;
  area: string;
  image: string;
  sports: string[];
  pricePerHour: number;
  distanceKm: number;
  rating: number;
  isOpenNow: boolean;
};

export type HostedGame = {
  id: string;
  sport: string;
  venueName: string;
  area: string;
  startsAt: string;
  day: string;
  hostName: string;
  hostInitials: string;
  spotsTotal: number;
  spotsFilled: number;
  pricePerHead: number;
  skillLevel: "Beginner" | "Intermediate" | "Advanced" | "All levels";
};

export type Group = {
  id: string;
  name: string;
  sport: string;
  members: number;
  image: string;
  blurb: string;
};

export type CommunityEvent = {
  id: string;
  title: string;
  sport: string;
  date: string;
  venueName: string;
  image: string;
  entryFee: string;
  slotsLeft: number;
};

export const cities: City[] = [
  { id: "kanpur", name: "Kanpur", state: "Uttar Pradesh", live: true },
  { id: "lucknow", name: "Lucknow", state: "Uttar Pradesh", live: false },
  { id: "varanasi", name: "Varanasi", state: "Uttar Pradesh", live: false },
  { id: "prayagraj", name: "Prayagraj", state: "Uttar Pradesh", live: false },
];

export const areas: string[] = [
  "Swaroop Nagar",
  "Kakadeo",
  "Civil Lines",
  "Kalyanpur",
  "Govind Nagar",
  "Panki",
  "Barra",
];

export const sports: Sport[] = [
  { id: "cricket", name: "Cricket", emoji: "🏏", venueCount: 24 },
  { id: "box-cricket", name: "Box Cricket", emoji: "🎯", venueCount: 18 },
  { id: "football", name: "Football", emoji: "⚽", venueCount: 15 },
  { id: "badminton", name: "Badminton", emoji: "🏸", venueCount: 31 },
  { id: "tennis", name: "Tennis", emoji: "🎾", venueCount: 9 },
  { id: "pickleball", name: "Pickleball", emoji: "🥒", venueCount: 6 },
  { id: "basketball", name: "Basketball", emoji: "🏀", venueCount: 7 },
  { id: "table-tennis", name: "Table Tennis", emoji: "🏓", venueCount: 12 },
  { id: "swimming", name: "Swimming", emoji: "🏊", venueCount: 5 },
  { id: "volleyball", name: "Volleyball", emoji: "🏐", venueCount: 4 },
];

export const venues: Venue[] = [
  {
    id: "v1",
    name: "Greenfield Box Arena",
    area: "Kakadeo",
    image: venueBoxCricket,
    sports: ["Box Cricket", "Football"],
    pricePerHour: 900,
    distanceKm: 2.4,
    rating: 4.6,
    isOpenNow: true,
  },
  {
    id: "v2",
    name: "Smash Point Badminton",
    area: "Swaroop Nagar",
    image: venueBadminton,
    sports: ["Badminton", "Table Tennis"],
    pricePerHour: 450,
    distanceKm: 3.1,
    rating: 4.8,
    isOpenNow: true,
  },
  {
    id: "v3",
    name: "Ganga Sports Club",
    area: "Civil Lines",
    image: venueTennis,
    sports: ["Tennis", "Pickleball"],
    pricePerHour: 700,
    distanceKm: 5.2,
    rating: 4.4,
    isOpenNow: false,
  },
  {
    id: "v4",
    name: "Turf 11 Kalyanpur",
    area: "Kalyanpur",
    image: venueBoxCricket,
    sports: ["Football", "Box Cricket"],
    pricePerHour: 1100,
    distanceKm: 6.8,
    rating: 4.7,
    isOpenNow: true,
  },
  {
    id: "v5",
    name: "Panki Play Factory",
    area: "Panki",
    image: venueBadminton,
    sports: ["Badminton", "Basketball"],
    pricePerHour: 500,
    distanceKm: 8.3,
    rating: 4.2,
    isOpenNow: true,
  },
  {
    id: "v6",
    name: "Barra Court Complex",
    area: "Barra",
    image: venueTennis,
    sports: ["Pickleball", "Tennis"],
    pricePerHour: 600,
    distanceKm: 9.1,
    rating: 4.5,
    isOpenNow: false,
  },
];

export const featuredHostedGame: HostedGame = {
  id: "g0",
  sport: "Football",
  venueName: "Turf 11 Kalyanpur",
  area: "Kalyanpur",
  startsAt: "8:00 PM – 9:30 PM",
  day: "Tonight",
  hostName: "Aryan Mishra",
  hostInitials: "AM",
  spotsTotal: 10,
  spotsFilled: 6,
  pricePerHead: 150,
  skillLevel: "Intermediate",
};

export const hostedGames: HostedGame[] = [
  {
    id: "g1",
    sport: "Box Cricket",
    venueName: "Greenfield Box Arena",
    area: "Kakadeo",
    startsAt: "7:00 PM – 8:00 PM",
    day: "Tonight",
    hostName: "Rohit Verma",
    hostInitials: "RV",
    spotsTotal: 12,
    spotsFilled: 9,
    pricePerHead: 120,
    skillLevel: "All levels",
  },
  {
    id: "g2",
    sport: "Badminton",
    venueName: "Smash Point Badminton",
    area: "Swaroop Nagar",
    startsAt: "6:30 AM – 7:30 AM",
    day: "Tomorrow",
    hostName: "Neha Gupta",
    hostInitials: "NG",
    spotsTotal: 4,
    spotsFilled: 2,
    pricePerHead: 100,
    skillLevel: "Beginner",
  },
  {
    id: "g3",
    sport: "Football",
    venueName: "Turf 11 Kalyanpur",
    area: "Kalyanpur",
    startsAt: "9:00 PM – 10:30 PM",
    day: "Tonight",
    hostName: "Sahil Khan",
    hostInitials: "SK",
    spotsTotal: 10,
    spotsFilled: 8,
    pricePerHead: 150,
    skillLevel: "Advanced",
  },
  {
    id: "g4",
    sport: "Pickleball",
    venueName: "Barra Court Complex",
    area: "Barra",
    startsAt: "5:00 PM – 6:00 PM",
    day: "Sat, 29 Aug",
    hostName: "Ishita Rai",
    hostInitials: "IR",
    spotsTotal: 4,
    spotsFilled: 1,
    pricePerHead: 180,
    skillLevel: "Intermediate",
  },
];

export const groups: Group[] = [
  {
    id: "gr1",
    name: "Kanpur Football Circle",
    sport: "Football",
    members: 842,
    image: groupFootball,
    blurb: "Weeknight 7s at Kalyanpur. Turf book ho chuka hai, bas aa jao.",
  },
  {
    id: "gr2",
    name: "Weekend Warriors Cricket",
    sport: "Box Cricket",
    members: 1236,
    image: groupCricket,
    blurb: "Sunday morning box cricket league across Kakadeo & Panki.",
  },
  {
    id: "gr3",
    name: "Smash Squad Kanpur",
    sport: "Badminton",
    members: 517,
    image: groupBadminton,
    blurb: "Early morning doubles crew. Beginners always welcome.",
  },
  {
    id: "gr4",
    name: "Civil Lines Racket Club",
    sport: "Tennis",
    members: 264,
    image: groupFootball,
    blurb: "Tennis & pickleball rallies every evening at Ganga Sports Club.",
  },
];

export const events: CommunityEvent[] = [
  {
    id: "e1",
    title: "Kanpur Premier Box League",
    sport: "Box Cricket",
    date: "Sat, 12 Sep · 6:00 PM",
    venueName: "Greenfield Box Arena",
    image: eventTournament,
    entryFee: "₹2,400 / team",
    slotsLeft: 6,
  },
  {
    id: "e2",
    title: "Monsoon 5-a-side Cup",
    sport: "Football",
    date: "Sun, 20 Sep · 7:00 AM",
    venueName: "Turf 11 Kalyanpur",
    image: groupFootball,
    entryFee: "₹1,800 / team",
    slotsLeft: 3,
  },
  {
    id: "e3",
    title: "Beginner Badminton Camp",
    sport: "Badminton",
    date: "Every Sat · 8:00 AM",
    venueName: "Smash Point Badminton",
    image: groupBadminton,
    entryFee: "₹999 / month",
    slotsLeft: 11,
  },
  {
    id: "e4",
    title: "Pickleball Open Doubles",
    sport: "Pickleball",
    date: "Sun, 27 Sep · 5:00 PM",
    venueName: "Barra Court Complex",
    image: groupCricket,
    entryFee: "₹600 / pair",
    slotsLeft: 8,
  },
];

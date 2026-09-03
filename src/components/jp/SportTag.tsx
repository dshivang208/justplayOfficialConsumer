const sportPalette = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

function getSportBgClass(sport: string) {
  let hash = 0;
  for (let i = 0; i < sport.length; i++) {
    hash = sport.charCodeAt(i) + ((hash << 5) - hash);
  }
  return sportPalette[Math.abs(hash) % sportPalette.length];
}

export function SportTag({ sport }: { sport: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-background ${getSportBgClass(sport)}`}
    >
      {sport}
    </span>
  );
}

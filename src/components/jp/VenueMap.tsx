import { useEffect, useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { MapPin, Navigation } from "lucide-react";

const GOOGLE_MAPS_API_KEY = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string | undefined;

// A close match to Google's own "Silver"-family light theme — quiet greys,
// no default POI icon clutter, roads and water left in Google's normal
// colors so it still reads as an actual Google Map rather than a filtered
// one.
const mapStyles: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

/** Real venue location map using the Google Maps JavaScript API — this is
 *  the actual Google Maps product (pan/zoom controls, road data, terrain),
 *  not a look-alike. Requires a Google Maps API key configured as
 *  VITE_GOOGLE_MAPS_API_KEY. Rendered client-only: this app server-renders
 *  routes, and the Maps SDK reaches for `window`/`document` on load, so
 *  mounting it only after the initial client render avoids a hydration
 *  mismatch (server and first client paint show the same skeleton; the
 *  real map swaps in right after). */
export function VenueMap({
  latitude,
  longitude,
  name,
}: {
  latitude: number | null;
  longitude: number | null;
  name: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "justplay-google-maps",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
  });

  if (latitude == null || longitude == null) {
    return (
      <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-raised">
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative text-center">
          <MapPin className="mx-auto h-7 w-7 text-primary" />
          <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
            Exact location pin isn't set for this venue yet
          </p>
        </div>
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-surface-raised px-4 text-center">
        <MapPin className="h-6 w-6 text-muted-foreground" />
        <p className="text-xs font-semibold text-foreground">Google Maps needs an API key</p>
        <p className="text-[11px] text-muted-foreground">
          Add VITE_GOOGLE_MAPS_API_KEY to your .env.local to show the real map here.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-border bg-surface-raised px-4 text-center text-xs font-semibold text-destructive">
        Couldn't load Google Maps — check the API key and enabled APIs in Google Cloud Console.
      </div>
    );
  }

  if (!mounted || !isLoaded) {
    return <div className="h-56 animate-pulse rounded-xl border border-border bg-surface-raised" />;
  }

  const position = { lat: latitude, lng: longitude };

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <GoogleMap
        mapContainerClassName="h-56 w-full"
        center={position}
        zoom={15}
        options={{
          styles: mapStyles,
          disableDefaultUI: true,
          zoomControl: true,
          scrollwheel: false,
          clickableIcons: false,
        }}
      >
        <MarkerF position={position} title={name} />
      </GoogleMap>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1.5 border-t border-border bg-surface py-2.5 text-xs font-semibold text-primary hover:bg-secondary"
      >
        <Navigation className="h-3.5 w-3.5" /> Get Directions
      </a>
    </div>
  );
}
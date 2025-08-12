import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Types for parsed event
type Coordinates = { lat: number; lng: number };

type ParsedEvent = {
  coords: Coordinates;
  tracker?: unknown;
  asset?: unknown;
  raw: any;
  receivedAt: number;
};

function isNumberish(v: any): v is number {
  return typeof v === "number" && !isNaN(v);
}

// Recursively search for latitude/longitude keys (case-insensitive)
function extractCoordinates(obj: any): Coordinates | null {
  if (!obj || typeof obj !== "object") return null;

  // Normalize keys into a flat map for single-level finds
  const entries = Object.entries(obj);
  const lowerKeyMap = new Map(entries.map(([k, v]) => [k.toLowerCase(), v]));

  const latKey = ["lat", "latitude"].find((k) => lowerKeyMap.has(k));
  const lngKey = ["lng", "lon", "long", "longitude"].find((k) =>
    lowerKeyMap.has(k)
  );

  if (latKey && lngKey) {
    const lat = Number(lowerKeyMap.get(latKey));
    const lng = Number(lowerKeyMap.get(lngKey));
    if (isNumberish(lat) && isNumberish(lng)) {
      return { lat, lng };
    }
  }

  // Recurse into child objects/arrays
  for (const [, v] of entries) {
    if (v && typeof v === "object") {
      const res = extractCoordinates(v);
      if (res) return res;
    }
  }

  return null;
}

// Try to find "tracker" and "asset" nodes
function extractDetails(obj: any): { tracker?: unknown; asset?: unknown } {
  if (!obj || typeof obj !== "object") return {};

  let tracker: unknown | undefined;
  let asset: unknown | undefined;

  const entries = Object.entries(obj);
  for (const [k, v] of entries) {
    const key = k.toLowerCase();
    if (!tracker && key.includes("tracker")) tracker = v;
    if (!asset && key.includes("asset")) asset = v;
  }

  // If not found at this level, attempt recursion
  if (!tracker || !asset) {
    for (const [, v] of entries) {
      if (v && typeof v === "object") {
        const nested = extractDetails(v);
        tracker = tracker ?? nested.tracker;
        asset = asset ?? nested.asset;
      }
    }
  }

  return { tracker, asset };
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
}

const MAP_KEY_STORAGE = "mapbox.public.token";
const WEBHOOK_URL_STORAGE = "webhook.url.input";
const TRACKER_POS_STORAGE = "dc.trackerPositions";

function trackerKeyFromUnknown(tr: any): string | null {
  try {
    if (!tr || typeof tr !== "object") return null;
    const entries = Object.entries(tr as Record<string, any>);
    const lower = new Map(entries.map(([k, v]) => [k.toLowerCase(), v]));
    const id = lower.get("id") ?? lower.get("trackerid") ?? lower.get("deviceid");
    const name = lower.get("name") ?? lower.get("trackername") ?? lower.get("devicename");
    if (typeof id === "string" && id.trim()) return id.trim();
    if (typeof name === "string" && name.trim()) return name.trim();
    return null;
  } catch {
    return null;
  }
}


const LiveMap: React.FC = () => {
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapToken, setMapToken] = useState<string>(
    () => localStorage.getItem(MAP_KEY_STORAGE) ?? ""
  );
  const [webhookUrl, setWebhookUrl] = useState<string>(
    () => localStorage.getItem(WEBHOOK_URL_STORAGE) ?? ""
  );
  const [listening, setListening] = useState(false);
  const [events, setEvents] = useState<ParsedEvent[]>([]);

  const canInitMap = useMemo(() => mapToken.trim().length > 10, [mapToken]);

  useEffect(() => {
    if (!mapContainer.current || !canInitMap) return;

    mapboxgl.accessToken = mapToken.trim();

    // Initialize map once
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      projection: "globe",
      zoom: 1.8,
      center: [0, 20],
      pitch: 45,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );
    map.scrollZoom.disable();

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(255,255,255)",
        "high-color": "rgb(200, 200, 225)",
        "horizon-blend": 0.2,
      } as any);
    });

    // Auto-rotation disabled to keep map static
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    return () => {
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [canInitMap]);

function saveTrackerPosition(tracker: unknown, coords: Coordinates) {
  try {
    const key = trackerKeyFromUnknown(tracker);
    if (!key) return;
    const map: Record<string, { lat: number; lng: number; receivedAt: number }> =
      JSON.parse(localStorage.getItem(TRACKER_POS_STORAGE) || "{}");
    map[key] = { lat: coords.lat, lng: coords.lng, receivedAt: Date.now() };
    localStorage.setItem(TRACKER_POS_STORAGE, JSON.stringify(map));
  } catch {}
}

function addMarker(ev: ParsedEvent) {
  if (!mapRef.current) return;
  const m = new mapboxgl.Marker({ color: "#2563eb" }) // using default accent-blue from mapbox marker, UI colors come from map style
    .setLngLat([ev.coords.lng, ev.coords.lat]);

  const html = `
      <div style="min-width:220px;max-width:280px;">
        <div style="font-weight:600;margin-bottom:6px;">Tracker & Asset</div>
        ${ev.tracker ? `<div style="font-size:12px;margin-bottom:6px;"><div style='font-weight:600;margin-bottom:2px;'>Tracker</div><pre style="white-space:pre-wrap;word-wrap:break-word;font-size:12px;">${safeStringify(ev.tracker)}</pre></div>` : ""}
        ${ev.asset ? `<div style="font-size:12px;margin-bottom:6px;"><div style='font-weight:600;margin-bottom:2px;'>Asset</div><pre style="white-space:pre-wrap;word-wrap:break-word;font-size:12px;">${safeStringify(ev.asset)}</pre></div>` : ""}
        <div style="font-size:12px;color:#6b7280;">Lat: ${ev.coords.lat.toFixed(
          6
        )}, Lng: ${ev.coords.lng.toFixed(6)}</div>
      </div>
    `;

  const popup = new mapboxgl.Popup({ offset: 16 }).setHTML(html);
  m.setPopup(popup).addTo(mapRef.current);
  markersRef.current.push(m);

  // persist last known tracker position
  saveTrackerPosition(ev.tracker, ev.coords);

  // Center map to the latest point
  mapRef.current.easeTo({
    center: [ev.coords.lng, ev.coords.lat],
    zoom: Math.max(mapRef.current.getZoom(), 4),
    duration: 800,
  });
}

  // Polling for webhook URL (note: may fail due to CORS depending on source)
  useEffect(() => {
    if (!listening || !webhookUrl) return;

    let stopped = false;
    const POLL_MS = 5000;

const poll = async () => {
  try {
    const res = await fetch(webhookUrl, { method: "POST" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const root = data?.Output ?? data; // Support "Output" wrapper
    const coords = extractCoordinates(root);
    if (coords) {
      const { tracker, asset } = extractDetails(root);
      const ev: ParsedEvent = { coords, tracker, asset, raw: root, receivedAt: Date.now() };
      setEvents((prev) => [ev, ...prev].slice(0, 50));
      addMarker(ev);
      // save last known tracker position
      saveTrackerPosition(tracker, coords);
    }
  } catch (err: any) {
    toast({
      title: "Webhook polling failed",
      description:
        (err?.message || "Unknown error") +
        ". If this is due to CORS, paste a sample payload below.",
    });
  } finally {
    if (!stopped) setTimeout(poll, POLL_MS);
  }
};

    poll();

    return () => {
      stopped = true;
    };
  }, [listening, webhookUrl]);

  // Handlers
  const handleSaveToken = () => {
    localStorage.setItem(MAP_KEY_STORAGE, mapToken.trim());
    toast({ title: "Map token saved" });
  };
  const handleSaveWebhook = () => {
    localStorage.setItem(WEBHOOK_URL_STORAGE, webhookUrl.trim());
    toast({ title: "Webhook URL saved" });
  };

  const handleFetchOnce = async () => {
    if (!webhookUrl) {
      toast({ title: "Enter webhook URL" });
      return;
    }
    try {
      const res = await fetch(webhookUrl, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const root = (data as any)?.Output ?? data;
      const coords = extractCoordinates(root);
      if (coords) {
        const { tracker, asset } = extractDetails(root);
        const ev: ParsedEvent = {
          coords,
          tracker,
          asset,
          raw: root,
          receivedAt: Date.now(),
        };
setEvents((prev) => [ev, ...prev].slice(0, 50));
addMarker(ev);
// persist last known tracker position
saveTrackerPosition(tracker, coords);
toast({ title: "Fetched and plotted latest event" });
      } else {
        toast({ title: "No coordinates found", description: "Response did not contain latitude/longitude" });
      }
    } catch (e: any) {
      toast({ title: "Fetch failed", description: e?.message || String(e) });
    }
  };

  const [sample, setSample] = useState<string>("");
  const handlePlotSample = () => {
    try {
      const parsed = JSON.parse(sample);
      const root = parsed?.Output ?? parsed;
      const coords = extractCoordinates(root);
      if (!coords) throw new Error("No coordinates found in payload");
      const { tracker, asset } = extractDetails(root);
      const ev: ParsedEvent = {
        coords,
        tracker,
        asset,
        raw: root,
        receivedAt: Date.now(),
      };
setEvents((prev) => [ev, ...prev].slice(0, 50));
addMarker(ev);
// persist last known tracker position
saveTrackerPosition(tracker, coords);
toast({ title: "Sample plotted" });
    } catch (e: any) {
      toast({ title: "Invalid JSON", description: e?.message || String(e) });
    }
  };

  return (
    <section className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4">
      <article className="lg:col-span-2">
        <div
          ref={mapContainer}
          className="w-full h-[60vh] lg:h-[70vh] rounded-md border"
          aria-label="Live location map"
        />
        {!canInitMap && (
          <div className="mt-4 text-sm text-muted-foreground">
            Enter your Mapbox public token to initialize the map.
          </div>
        )}
      </article>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mapbox public token</label>
              <div className="flex gap-2">
                <Input
                  placeholder="pk.eyJ..."
                  value={mapToken}
                  onChange={(e) => setMapToken(e.target.value)}
                />
                <Button onClick={handleSaveToken}>Save</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your token from the Mapbox dashboard.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Webhook URL</label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <Button variant={listening ? "secondary" : "default"} onClick={() => setListening((v) => !v)}>
                  {listening ? "Stop" : "Listen"}
                </Button>
                <Button variant="outline" onClick={handleSaveWebhook}>
                  Save
                </Button>
                <Button variant="outline" onClick={handleFetchOnce}>
                  Fetch once
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We will poll this URL every few seconds. If CORS blocks it, paste
                a sample payload below.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test with sample JSON</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              className="w-full h-40 rounded-md border bg-background p-2 text-sm"
              placeholder='{"Output": {"latitude":12.97, "longitude":77.59, "tracker": {"id":"T-1"}, "asset": {"name":"Truck 7"}}}'
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={handlePlotSample}>Plot sample</Button>
            </div>
          </CardContent>
        </Card>

        {events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent events</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="max-h-48 overflow-auto space-y-2 text-sm">
                {events.map((e, i) => (
                  <li key={e.receivedAt + "-" + i} className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="font-medium">
                        {new Date(e.receivedAt).toLocaleTimeString()} — {e.coords.lat.toFixed(3)}, {e.coords.lng.toFixed(3)}
                      </div>
                      <div className="text-muted-foreground truncate max-w-[18rem]">
                        {e.tracker ? "Tracker • " : ""}
                        {e.asset ? "Asset • " : ""}
                        {Object.keys(e.raw || {}).slice(0, 4).join(", ")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </aside>
    </section>
  );
};

export default LiveMap;

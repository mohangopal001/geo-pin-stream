// Utility to process incoming webhook payloads and bind them to localStorage schema
// - Ensures Asset, Tracker, and Link records exist/update
// - Updates last known tracker position and appends tracking logs (optional)
//
// Storage keys aligned with DeviceConfig/LiveMap/Dashboard
const LS_ASSETS = "dc.assets";
const LS_TRACKERS = "dc.trackers";
const LS_LINKS = "dc.links";
const LS_TRACKER_POS = "dc.trackerPositions";
const LS_TRACKING_LOGS = "dc.trackingLogs";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function slugify(input: string): string {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function toPercentBattery(v: any): number | null {
  if (v == null) return null;
  const num = Number(v);
  if (isNaN(num)) return null;
  if (num <= 1) return Math.round(num * 100);
  if (num <= 100) return Math.round(num);
  return 100;
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Partial<T> {
  const out: Partial<T> = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) (out as any)[k] = obj[k];
  });
  return out;
}

export type TrackingWebhook = any; // accept flexible payloads

// Extract helpers tolerant to different key spellings/cases
function get(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  // direct
  if (key in obj) return obj[key];
  // case-insensitive and with spaces
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
}

function resolveAssetFields(p: any) {
  const id = get(p, "ID") ?? get(p, "Asset ID") ?? get(p, "assetId") ?? get(p, "asset_id");
  const name = get(p, "Asset Name") ?? get(p, "assetName") ?? get(p, "asset")?.name ?? get(p, "asset_name");
  const status = get(p, "Asset Status") ?? get(p, "assetStatus") ?? get(p, "asset_status");
  return { id, name, status } as { id?: any; name?: any; status?: any };
}

function resolveTrackerFields(p: any) {
  const name =
    get(p, "GPS Tracker Name") ?? get(p, "trackerName") ?? get(p, "tracker")?.name ?? get(p, "deviceName");
  const id = get(p, "trackerId") ?? get(p, "Tracker ID") ?? get(p, "deviceId") ?? get(p, "tracker")?.id;
  const status = get(p, "GPS Tracker Status") ?? get(p, "trackerStatus");
  const battery = get(p, "GPS Tracker Battery") ?? get(p, "battery") ?? get(p, "batteryLevel");
  return { id, name, status, battery } as { id?: any; name?: any; status?: any; battery?: any };
}

function resolveTrackingFields(p: any) {
  const lat = get(p, "Latitude") ?? get(p, "latitude") ?? get(p, "lat");
  const lng = get(p, "Longitude") ?? get(p, "longitude") ?? get(p, "lng") ?? get(p, "long") ?? get(p, "lon");
  const trackingStatus = get(p, "Tracking Status") ?? get(p, "linkStatus") ?? get(p, "status");
  const timestamp = get(p, "timestamp") ?? Date.now();
  return { lat: Number(lat), lng: Number(lng), trackingStatus, timestamp };
}

export function processTrackingWebhook(payload: TrackingWebhook) {
  try {
    const p = payload?.Output ?? payload;
    const asset = resolveAssetFields(p);
    const tracker = resolveTrackerFields(p);
    const track = resolveTrackingFields(p);

    if (isNaN(track.lat) || isNaN(track.lng)) {
      // No coordinates: we still may update master/link data
    }

    // Prepare IDs
    const assetId = asset.id != null && String(asset.id).trim() !== "" ? String(asset.id) : asset.name ? slugify(String(asset.name)) : undefined;
    const trackerId = tracker.id != null && String(tracker.id).trim() !== "" ? String(tracker.id) : tracker.name ? slugify(String(tracker.name)) : undefined;

    // Load current state
    const assets = readJSON<any[]>(LS_ASSETS, []);
    const trackers = readJSON<any[]>(LS_TRACKERS, []);
    const links = readJSON<any[]>(LS_LINKS, []);

    // Upsert Asset
    if (assetId || asset.name) {
      const idx = assets.findIndex((a) => a.id === assetId);
      const base = idx >= 0 ? assets[idx] : null;
      const next = {
        id: assetId ?? (base?.id ?? slugify(String(asset.name || "asset"))),
        name: asset.name ?? base?.name ?? "Asset",
        description: base?.description ?? "",
        type: base?.type ?? "Movable",
        baseLocation: base?.baseLocation ?? "",
        status: (asset.status as any) ?? base?.status ?? "Active",
      };
      if (idx >= 0) assets[idx] = next; else assets.push(next);
      writeJSON(LS_ASSETS, assets);
    }

    // Upsert Tracker
    if (trackerId || tracker.name) {
      const idx = trackers.findIndex((t) => t.id === (trackerId ?? slugify(String(tracker.name))));
      const base = idx >= 0 ? trackers[idx] : null;
      const battery = toPercentBattery(tracker.battery);
      const next = {
        id: trackerId ?? (base?.id ?? slugify(String(tracker.name || "tracker"))),
        name: tracker.name ?? base?.name ?? "Tracker",
        model: base?.model ?? "",
        batteryLevel: battery ?? base?.batteryLevel ?? 0,
        status: (tracker.status as any) ?? base?.status ?? "Active",
      };
      if (idx >= 0) trackers[idx] = { ...base, ...pick(next, ["name", "batteryLevel", "status"]) };
      else trackers.push(next);
      writeJSON(LS_TRACKERS, trackers);
    }

    // Upsert Link (one tracker -> one asset)
    if (assetId && trackerId) {
      // Remove conflicting links for this tracker
      const filtered = links.filter((l) => l.trackerId !== trackerId || l.assetId === assetId);
      const exists = filtered.some((l) => l.assetId === assetId && l.trackerId === trackerId);
      if (!exists) filtered.push({ assetId, trackerId, status: (track.trackingStatus as any) || "Active" });
      else {
        // update status
        filtered.forEach((l) => {
          if (l.assetId === assetId && l.trackerId === trackerId) l.status = (track.trackingStatus as any) || l.status;
        });
      }
      writeJSON(LS_LINKS, filtered);
    }

    // Update tracking positions/logs
    if (!isNaN(track.lat) && !isNaN(track.lng) && trackerId) {
      const posMap = readJSON<Record<string, { lat: number; lng: number; receivedAt: number }>>(LS_TRACKER_POS, {});
      posMap[trackerId] = { lat: track.lat, lng: track.lng, receivedAt: Number(track.timestamp) || Date.now() };
      writeJSON(LS_TRACKER_POS, posMap);

      const logsMap = readJSON<Record<string, Array<{ lat: number; lng: number; receivedAt: number }>>>(LS_TRACKING_LOGS, {});
      const arr = logsMap[trackerId] ?? [];
      arr.push({ lat: track.lat, lng: track.lng, receivedAt: Number(track.timestamp) || Date.now() });
      logsMap[trackerId] = arr.slice(-500);
      writeJSON(LS_TRACKING_LOGS, logsMap);
    }
  } catch (e) {
    // noop
  }
}

import React, { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type TrackPoint = { lat: number; lng: number; receivedAt: number };

const MAP_KEY_STORAGE = "mapbox.public.token";

type Props = {
  points: TrackPoint[];
  heightClass?: string;
};

const TrackMap: React.FC<Props> = ({ points, heightClass = "h-80" }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const token = useMemo(() => localStorage.getItem(MAP_KEY_STORAGE) ?? "", []);
  const canInit = token.trim().length > 10;

  useEffect(() => {
    if (!mapContainer.current || !canInit) return;

    mapboxgl.accessToken = token.trim();
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      projection: "globe",
      zoom: 2,
      center: [0, 20],
      pitch: 0,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    return () => {
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [canInit, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderTrack = () => {
      // Remove existing source/layers if present
      if (map.getLayer("track-line")) map.removeLayer("track-line");
      if (map.getSource("track-source")) map.removeSource("track-source");

      const pts = [...points].sort((a, b) => a.receivedAt - b.receivedAt);
      if (pts.length === 0) {
        startMarkerRef.current?.remove();
        endMarkerRef.current?.remove();
        return;
      }

      const line: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: pts.map((p) => [p.lng, p.lat]),
        },
        properties: {},
      };

      map.addSource("track-source", {
        type: "geojson",
        data: line as any,
      });

      map.addLayer({
        id: "track-line",
        type: "line",
        source: "track-source",
        paint: {
          "line-color": "#2563eb",
          "line-width": 3,
        },
      });

      // Markers for start/end
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      startMarkerRef.current = new mapboxgl.Marker({ color: "#10b981" }) // emerald
        .setLngLat([pts[0].lng, pts[0].lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(`Start: ${new Date(pts[0].receivedAt).toLocaleString()}`))
        .addTo(map);
      endMarkerRef.current = new mapboxgl.Marker({ color: "#ef4444" }) // red
        .setLngLat([pts[pts.length - 1].lng, pts[pts.length - 1].lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(`Latest: ${new Date(pts[pts.length - 1].receivedAt).toLocaleString()}`))
        .addTo(map);

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      pts.forEach((p) => bounds.extend([p.lng, p.lat] as [number, number]));
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 48, duration: 600 });
      }
    };

    if (map.isStyleLoaded()) {
      renderTrack();
    } else {
      map.once("load", renderTrack);
    }
  }, [points]);

  return (
    <div className={`w-full ${heightClass} rounded-md border overflow-hidden`}>
      {!canInit ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4">
          Enter Mapbox token to view map
        </div>
      ) : (
        <div ref={mapContainer} className="w-full h-full" />
      )}
    </div>
  );
};

export default TrackMap;

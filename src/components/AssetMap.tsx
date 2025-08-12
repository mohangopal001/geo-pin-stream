import React, { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type AssetMarker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

const MAP_KEY_STORAGE = "mapbox.public.token";

const AssetMap: React.FC<{ markers: AssetMarker[] }>= ({ markers }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const canInitMap = useMemo(() => {
    const key = localStorage.getItem(MAP_KEY_STORAGE) ?? "";
    return key.trim().length > 10;
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !canInitMap) return;

    mapboxgl.accessToken = (localStorage.getItem(MAP_KEY_STORAGE) ?? "").trim();

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
    map.scrollZoom.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const addedMarkers: mapboxgl.Marker[] = [];

    const addAllMarkers = () => {
      // cleanup previous
      addedMarkers.forEach((m) => m.remove());
      addedMarkers.length = 0;

      if (!markers || markers.length === 0) return;
      const bounds = new mapboxgl.LngLatBounds();
      markers.forEach((mk) => {
        const marker = new mapboxgl.Marker({ color: "#2563eb" })
          .setLngLat([mk.lng, mk.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 12 }).setHTML(
              `<div style="font-weight:600;margin-bottom:4px;">${mk.label}</div><div style="font-size:12px;color:#6b7280">Lat: ${mk.lat.toFixed(5)}, Lng: ${mk.lng.toFixed(5)}</div>`
            )
          )
          .addTo(map);
        addedMarkers.push(marker);
        bounds.extend([mk.lng, mk.lat]);
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 40, maxZoom: 8, duration: 600 });
      }
    };

    // initial add
    addAllMarkers();

    return () => {
      addedMarkers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [canInitMap, markers]);

  return (
    <div className="w-full">
      <div ref={mapContainer} className="w-full h-[50vh] rounded-md border" />
      {!canInitMap && (
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your Mapbox public token in the Live Map panel to enable the map.
        </p>
      )}
    </div>
  );
};

export default AssetMap;

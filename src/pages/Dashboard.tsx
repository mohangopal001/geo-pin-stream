import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import AssetMap, { AssetMarker } from "@/components/AssetMap";

// LocalStorage keys aligned with DeviceConfig/LiveMap
const LS_ASSETS = "dc.assets";
const LS_TRACKERS = "dc.trackers";
const LS_LINKS = "dc.links";
const LS_TRACKER_POS = "dc.trackerPositions";

// Types mirrored from DeviceConfig (kept local to avoid large refactor)
type TrackerStatus = "Active" | "Inactive" | "Missing" | "Maintenance";
type AssetType = "Movable" | "Stationery";
type AssetStatus = TrackerStatus;

type Tracker = { id: string; name: string; model: string; batteryLevel: number; status: TrackerStatus };
type Asset = { id: string; name: string; description: string; type: AssetType; baseLocation: string; status: AssetStatus };
type LinkStatus = "Active" | "Inactive";
type AssetTrackerLink = { assetId: string; trackerId: string; status: LinkStatus };

type TrackerPos = { lat: number; lng: number; receivedAt: number };

type Row = {
  asset: Asset;
  tracker?: Tracker;
  link?: AssetTrackerLink;
  position?: TrackerPos;
};

const Dashboard: React.FC = () => {
  const title = "Asset Tracker Dashboard – Status and Locations";
  const description = "Paginated table of assets with tracker status and current lat/long, plus a map with pins.";

  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const [rows, setRows] = React.useState<Row[]>([]);
  const [markers, setMarkers] = React.useState<AssetMarker[]>([]);

  React.useEffect(() => {
    const assets: Asset[] = JSON.parse(localStorage.getItem(LS_ASSETS) || "[]");
    const trackers: Tracker[] = JSON.parse(localStorage.getItem(LS_TRACKERS) || "[]");
    const links: AssetTrackerLink[] = JSON.parse(localStorage.getItem(LS_LINKS) || "[]");
    const posMap: Record<string, TrackerPos> = JSON.parse(localStorage.getItem(LS_TRACKER_POS) || "{}");

    const trackerById = new Map(trackers.map((t) => [t.id, t] as const));

    const linkedRows: Row[] = assets.map((a) => {
      const link = links.find((l) => l.assetId === a.id);
      const tracker = link ? trackerById.get(link.trackerId) : undefined;
      // Position key: prefer tracker.id
      const pos = tracker ? posMap[tracker.id] || posMap[tracker.name] : undefined;
      return { asset: a, tracker, link, position: pos };
    });

    setRows(linkedRows);
  }, []);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  React.useEffect(() => {
    const ms: AssetMarker[] = pageRows
      .filter((r) => r.position && r.tracker)
      .map((r) => ({
        id: r.tracker!.id,
        label: `${r.asset.name} • ${r.tracker!.name}`,
        lat: r!.position!.lat,
        lng: r!.position!.lng,
      }));
    setMarkers(ms);
  }, [pageRows]);

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/dashboard'} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Asset Tracker Dashboard",
            description,
          })}
        </script>
      </Helmet>

      <header className="container mx-auto py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Asset Tracker Dashboard</h1>
          <Button asChild variant="outline">
            <Link to="/">Configure Devices</Link>
          </Button>
        </div>
        <p className="text-muted-foreground mt-2">View assets, their linked GPS trackers, current coordinates, and statuses.</p>
      </header>

      <main className="container mx-auto pb-12 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assets Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>Showing {pageRows.length} of {rows.length} assets</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Name</TableHead>
                    <TableHead>GPS Tracker Name</TableHead>
                    <TableHead>GPS Location</TableHead>
                    <TableHead>Asset Status</TableHead>
                    <TableHead>GPS Tracker Status</TableHead>
                    <TableHead>GPS Tracker Battery</TableHead>
                    <TableHead>Tracking Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No assets found. Add assets, trackers, and link them on the home page.
                      </TableCell>
                    </TableRow>
                  )}
                  {pageRows.map((r) => (
                    <TableRow key={r.asset.id}>
                      <TableCell className="font-medium">{r.asset.name}</TableCell>
                      <TableCell>{r.tracker?.name ?? "—"}</TableCell>
                      <TableCell>
                        {r.position ? (
                          <span>Latitude: {r.position.lat.toFixed(5)}, Longitude: {r.position.lng.toFixed(5)}</span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{r.asset.status}</TableCell>
                      <TableCell>{r.tracker?.status ?? "—"}</TableCell>
                      <TableCell>{r.tracker ? `${r.tracker.batteryLevel}%` : "—"}</TableCell>
                      <TableCell>{r.link?.status ?? "—"}</TableCell>
                      <TableCell>
                        <Button asChild variant="link" className="px-0"> 
                          <Link to="/">Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {rows.length > 10 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                      <PaginationItem key={num}>
                        <PaginationLink href="#" isActive={num === page} onClick={(e) => { e.preventDefault(); setPage(num); }}>
                          {num}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Map – Assets on current page</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetMap markers={markers} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TrackMap, { TrackPoint } from "@/components/TrackMap";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetName: string;
  trackerName: string;
  logs: TrackPoint[];
};

const TrackingLogDialog: React.FC<Props> = ({ open, onOpenChange, assetName, trackerName, logs }) => {
  const latestFirst = React.useMemo(() => [...logs].sort((a, b) => b.receivedAt - a.receivedAt), [logs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Tracking Log — {assetName || "Asset"} • {trackerName || "Tracker"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestFirst.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      No tracking logs found for this tracker.
                    </TableCell>
                  </TableRow>
                ) : (
                  latestFirst.map((p, i) => (
                    <TableRow key={p.receivedAt + "-" + i}>
                      <TableCell>{new Date(p.receivedAt).toLocaleString()}</TableCell>
                      <TableCell>{p.lat.toFixed(6)}</TableCell>
                      <TableCell>{p.lng.toFixed(6)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div>
            <TrackMap points={logs} heightClass="h-[60vh]" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrackingLogDialog;

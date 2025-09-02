import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Types
type TrackerStatus = "Active" | "Inactive" | "Missing" | "Maintenance";

type Tracker = {
  id: string;
  name: string;
  model: string;
  batteryLevel: number; // 0-100
  status: TrackerStatus;
};

type AssetType = "Movable" | "Stationery";

type AssetStatus = TrackerStatus; // same options

type Asset = {
  id: string;
  name: string;
  description: string;
  type: AssetType;
  baseLocation: string;
  status: AssetStatus;
};

type LinkStatus = "Active" | "Inactive";

type AssetTrackerLink = {
  assetId: string;
  trackerId: string;
  status: LinkStatus;
};

type TabKey = "trackers" | "assets" | "link";

export default function DeviceConfig() {
  const { toast } = useToast();

const [trackers, setTrackers] = React.useState<Tracker[]>([]);
const [assets, setAssets] = React.useState<Asset[]>([]);
const [links, setLinks] = React.useState<AssetTrackerLink[]>([]);

// persist to localStorage so Dashboard can read
const LS_TRACKERS = "dc.trackers";
const LS_ASSETS = "dc.assets";
const LS_LINKS = "dc.links";

React.useEffect(() => {
  try {
    const t = JSON.parse(localStorage.getItem(LS_TRACKERS) || "[]");
    const a = JSON.parse(localStorage.getItem(LS_ASSETS) || "[]");
    const l = JSON.parse(localStorage.getItem(LS_LINKS) || "[]");
    if (Array.isArray(t)) setTrackers(t);
    if (Array.isArray(a)) setAssets(a);
    if (Array.isArray(l)) setLinks(l);
  } catch {}
}, []);

React.useEffect(() => {
  localStorage.setItem(LS_TRACKERS, JSON.stringify(trackers));
}, [trackers]);

React.useEffect(() => {
  localStorage.setItem(LS_ASSETS, JSON.stringify(assets));
}, [assets]);

React.useEffect(() => {
  localStorage.setItem(LS_LINKS, JSON.stringify(links));
}, [links]);

// Forms state - Tracker
const [tId, setTId] = React.useState("");
const [tName, setTName] = React.useState("");
const [tModel, setTModel] = React.useState("");
const [tBattery, setTBattery] = React.useState<number | "">("");
const [tStatus, setTStatus] = React.useState<TrackerStatus | "">("");

// Forms state - Asset
const [aId, setAId] = React.useState("");
const [aName, setAName] = React.useState("");
const [aDesc, setADesc] = React.useState("");
const [aType, setAType] = React.useState<AssetType | "">("");
const [aBase, setABase] = React.useState("");
const [aStatus, setAStatus] = React.useState<AssetStatus | "">("");

// Forms state - Link
const [selectedAssetId, setSelectedAssetId] = React.useState("");
const [selectedTrackerId, setSelectedTrackerId] = React.useState("");
const [linkStatus, setLinkStatus] = React.useState<LinkStatus | "">("");

// Tabs state and URL params preselection
const [tab, setTab] = React.useState<TabKey>("trackers");
React.useEffect(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const pTab = params.get("tab") as TabKey | null;
    const assetIdParam = params.get("assetId");
    const trackerIdParam = params.get("trackerId");
    if (pTab === "trackers" || pTab === "assets" || pTab === "link") setTab(pTab);
    if (assetIdParam) setSelectedAssetId(assetIdParam);
    if (trackerIdParam) setSelectedTrackerId(trackerIdParam);
  } catch {}
}, []);

  const trackerStatusOptions: TrackerStatus[] = [
    "Active",
    "Inactive",
    "Missing",
    "Maintenance",
  ];
  const assetTypeOptions: AssetType[] = ["Movable", "Stationery"]; 

  // Handlers
  const handleAddTracker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tId || !tName || !tModel || tBattery === "" || tStatus === "") {
      toast({ title: "Missing fields", description: "Please fill all tracker fields." });
      return;
    }
    const battery = Number(tBattery);
    if (isNaN(battery) || battery < 0 || battery > 100) {
      toast({ title: "Invalid battery", description: "Battery must be between 0 and 100." });
      return;
    }
    if (trackers.some((t) => t.id === tId)) {
      toast({ title: "Duplicate ID", description: "Tracker ID already exists." });
      return;
    }

    // Prepare API payload
    const apiPayload = {
      Device_id: tId,
      Device_name: tName,
      Device_model: tModel,
      battery_level: battery.toString(),
      Device_status: tStatus
    };

    try {
      // Call API endpoint
      const response = await fetch('http://127.0.0.1:5000/tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('API response:', responseData);

      // Only add to local state if API call succeeds
      setTrackers((prev) => [
        ...prev,
        { id: tId, name: tName, model: tModel, batteryLevel: battery, status: tStatus as TrackerStatus },
      ]);
      
      setTId("");
      setTName("");
      setTModel("");
      setTBattery("");
      setTStatus("");
      
      toast({ 
        title: "Tracker saved", 
        description: `${tName} added successfully to API and local storage.` 
      });

    } catch (error) {
      console.error('API call failed:', error);
      toast({ 
        title: "API Error", 
        description: `Failed to save tracker to API: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aId || !aName || !aDesc || !aType || !aBase || !aStatus) {
      toast({ title: "Missing fields", description: "Please fill all asset fields." });
      return;
    }
    if (assets.some((a) => a.id === aId)) {
      toast({ title: "Duplicate ID", description: "Asset ID already exists." });
      return;
    }

    // Prepare API payload
    const apiPayload = {
      asset_id: aId,
      asset_name: aName,
      asset_description: aDesc,
      asset_type: aType,
      base_location: aBase,
      asset_status: aStatus
    };

    try {
      // Call API endpoint
      const response = await fetch('http://127.0.0.1:5000/asset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('API response:', responseData);

      // Only add to local state if API call succeeds
      setAssets((prev) => [
        ...prev,
        {
          id: aId,
          name: aName,
          description: aDesc,
          type: aType as AssetType,
          baseLocation: aBase,
          status: aStatus as AssetStatus,
        },
      ]);
      
      setAId("");
      setAName("");
      setADesc("");
      setAType("");
      setABase("");
      setAStatus("");
      
      toast({ 
        title: "Asset saved", 
        description: `${aName} added successfully to API and local storage.` 
      });

    } catch (error) {
      console.error('API call failed:', error);
      toast({ 
        title: "API Error", 
        description: `Failed to save asset to API: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  const handleLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !selectedTrackerId || !linkStatus) {
      toast({ title: "Missing fields", description: "Please select asset, tracker, and status." });
      return;
    }
    // Validate: One GPS Tracker Device cannot be tagged to two Assets.
    const existing = links.find((l) => l.trackerId === selectedTrackerId);
    if (existing && existing.assetId !== selectedAssetId) {
      toast({
        title: "Validation error",
        description: "This tracker is already linked to another asset.",
      });
      return;
    }
    setLinks((prev) => {
      // replace if same pair exists
      const others = prev.filter(
        (l) => !(l.assetId === selectedAssetId && l.trackerId === selectedTrackerId)
      );
      return [
        ...others,
        { assetId: selectedAssetId, trackerId: selectedTrackerId, status: linkStatus as LinkStatus },
      ];
    });
    toast({ title: "Linked", description: "Asset linked to tracker." });
  };

  // helpers
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);
  const selectedTracker = trackers.find((t) => t.id === selectedTrackerId);

  return (
    <section className="mb-8">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-xl">Device and Asset Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configure Tracker Devices, manage Assets, and link an asset to a tracker. Data is stored in-memory for this session.
          </p>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList>
          <TabsTrigger value="trackers">Tracker Device Master</TabsTrigger>
          <TabsTrigger value="assets">Assets Master</TabsTrigger>
          <TabsTrigger value="link">Link Asset to Tracker</TabsTrigger>
        </TabsList>

        {/* Trackers */}
        <TabsContent value="trackers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tracker Device Master</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddTracker} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tId">Tracker Device ID</Label>
                  <Input id="tId" value={tId} onChange={(e) => setTId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tName">Tracker Device Name</Label>
                  <Input id="tName" value={tName} onChange={(e) => setTName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tModel">Tracker Device Model</Label>
                  <Input id="tModel" value={tModel} onChange={(e) => setTModel(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tBattery">Battery Level (%)</Label>
                  <Input
                    id="tBattery"
                    type="number"
                    min={0}
                    max={100}
                    value={tBattery}
                    onChange={(e) => setTBattery(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Device Status</Label>
                  <Select value={tStatus as string} onValueChange={(v) => setTStatus(v as TrackerStatus)}>
                    <SelectTrigger aria-label="Tracker Status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackerStatusOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Save Tracker</Button>
                </div>
              </form>

              {/* List */}
              {trackers.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Trackers</h3>
                  <div className="grid gap-2">
                    {trackers.map((t) => (
                      <div key={t.id} className="rounded-md border p-3 text-sm flex items-center justify-between">
                        <div>
                          <div className="font-medium">{t.name} <span className="text-muted-foreground">({t.id})</span></div>
                          <div className="text-muted-foreground">Model: {t.model} · Battery: {t.batteryLevel}% · Status: {t.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets */}
        <TabsContent value="assets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assets Master</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddAsset} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="aId">Asset ID</Label>
                  <Input id="aId" value={aId} onChange={(e) => setAId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aName">Asset Name</Label>
                  <Input id="aName" value={aName} onChange={(e) => setAName(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="aDesc">Asset Description</Label>
                  <Textarea id="aDesc" value={aDesc} onChange={(e) => setADesc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Asset Type</Label>
                  <Select value={aType as string} onValueChange={(v) => setAType(v as AssetType)}>
                    <SelectTrigger aria-label="Asset Type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aBase">Asset Base Location</Label>
                  <Input id="aBase" value={aBase} onChange={(e) => setABase(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Asset Status</Label>
                  <Select value={aStatus as string} onValueChange={(v) => setAStatus(v as AssetStatus)}>
                    <SelectTrigger aria-label="Asset Status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackerStatusOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Save Asset</Button>
                </div>
              </form>

              {/* List */}
              {assets.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Assets</h3>
                  <div className="grid gap-2">
                    {assets.map((a) => (
                      <div key={a.id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{a.name} <span className="text-muted-foreground">({a.id})</span></div>
                        <div className="text-muted-foreground">Type: {a.type} · Base: {a.baseLocation} · Status: {a.status}</div>
                        <p className="mt-1">{a.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Link */}
        <TabsContent value="link" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Link Asset to Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLink} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Select Asset Name</Label>
                  <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                    <SelectTrigger aria-label="Select Asset">
                      <SelectValue placeholder="Choose asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Tracker Name</Label>
                  <Select value={selectedTrackerId} onValueChange={setSelectedTrackerId}>
                    <SelectTrigger aria-label="Select Tracker">
                      <SelectValue placeholder="Choose tracker" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Details panels */}
                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <h4 className="text-sm font-medium mb-2">Asset Details</h4>
                    {selectedAsset ? (
                      <div className="text-sm">
                        <div className="text-muted-foreground">Description</div>
                        <div>{selectedAsset.description}</div>
                        <div className="text-muted-foreground mt-2">Location · Type · Status</div>
                        <div>
                          {selectedAsset.baseLocation} · {selectedAsset.type} · {selectedAsset.status}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Select an asset to view details.</p>
                    )}
                  </div>

                  <div className="rounded-md border p-3">
                    <h4 className="text-sm font-medium mb-2">Tracker Details</h4>
                    {selectedTracker ? (
                      <div className="text-sm">
                        <div className="text-muted-foreground">Model</div>
                        <div>{selectedTracker.model}</div>
                        <div className="text-muted-foreground mt-2">Battery · Status</div>
                        <div>
                          {selectedTracker.batteryLevel}% · {selectedTracker.status}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a tracker to view details.</p>
                    )}
                  </div>
                </div>

                {/* Link status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={linkStatus as string} onValueChange={(v) => setLinkStatus(v as LinkStatus)}>
                    <SelectTrigger aria-label="Link Status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Link</Button>
                </div>
              </form>

              {/* Existing links */}
              {links.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Links</h3>
                  <div className="grid gap-2">
                    {links.map((l, idx) => {
                      const a = assets.find((x) => x.id === l.assetId);
                      const t = trackers.find((x) => x.id === l.trackerId);
                      return (
                        <div key={`${l.assetId}-${l.trackerId}-${idx}`} className="rounded-md border p-3 text-sm flex items-center justify-between">
                          <div>
                            <div className="font-medium">{a?.name ?? l.assetId} ↔ {t?.name ?? l.trackerId}</div>
                            <div className="text-muted-foreground">Status: {l.status}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTab("link");
                                setSelectedAssetId(l.assetId);
                                setSelectedTrackerId(l.trackerId);
                                setLinkStatus(l.status);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setLinks((prev) => prev.filter((x) => x.assetId !== l.assetId));
                                toast({
                                  title: "Tracking removed",
                                  description: `Removed all links for ${a?.name ?? l.assetId}.`,
                                });
                              }}
                            >
                              Remove tracking
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

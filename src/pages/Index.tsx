import { Helmet } from "react-helmet-async";
import LiveMap from "@/components/LiveMap";
import DeviceConfig from "@/components/DeviceConfig";
const Index = () => {
  const title = "Live Tracker Map – Webhook-powered asset locations";
  const description =
    "Real-time map showing tracker and asset details from your webhook. Paste your Mapbox token and webhook to start plotting pins.";

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/'} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Live Tracker Map",
            description,
            applicationCategory: "MappingApplication",
          })}
        </script>
      </Helmet>

      <header className="container mx-auto py-10">
        <div className="space-y-3 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Live Tracker Map – Webhook Output
          </h1>
          <p className="text-muted-foreground text-lg">
            Connect your webhook URL and automatically plot pins by latitude/longitude.
            Click a pin to see Tracker and Asset details.
          </p>
          <div className="pt-2">
            <a
              href="/dashboard"
              className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              View Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto pb-12">
        <DeviceConfig />
        <LiveMap />
      </main>
    </div>
  );
};

export default Index;

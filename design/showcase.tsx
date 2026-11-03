import { useState } from "react";
import { Badge } from "../public/ui/Badge.tsx";
import { Button } from "../public/ui/Button.tsx";
import { RelativeTime } from "../public/ui/RelativeTime.tsx";
import { Segmented } from "../public/ui/Segmented.tsx";
import { Switch } from "../public/ui/Switch.tsx";
import type { Fixture } from "./fixture.ts";

const PREVIEWS = [
  ["episode", "Episode"],
  ["movie", "Movie"],
  ["track", "Music"],
] as const;

function Showcase() {
  const [enabled, setEnabled] = useState(true);
  const [preview, setPreview] = useState<(typeof PREVIEWS)[number][0]>("episode");
  const [sentAt] = useState(() => Date.now() - 3 * 60_000);
  return (
    <div className="stage-showcase">
      <div className="stage-showcase-row">
        <strong>Sonarr</strong>
        <Badge tone="success">Active</Badge>
      </div>
      <div className="stage-showcase-row">
        <span>Enabled</span>
        <Switch checked={enabled} onChange={setEnabled} aria-label="Enabled" />
      </div>
      <Segmented label="Preview with" options={PREVIEWS} value={preview} onChange={setPreview} />
      <p className="muted">
        Last sent <RelativeTime ms={sentAt} />
      </p>
      <div className="stage-showcase-actions">
        <Button>Cancel</Button>
        <Button variant="primary">Save</Button>
      </div>
    </div>
  );
}

export const showcase: Fixture = { component: Showcase };

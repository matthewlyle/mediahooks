export type Preset = {
  id: string;
  label: string;
  url: string;
  matches: (url: URL) => boolean;
  headers: string;
  body: string;
  attachPoster: boolean;
  events?: string[];
};

const json = (body: object) => JSON.stringify(body, null, 2);

export const PRESETS: Preset[] = [
  {
    id: "discord",
    label: "Discord",
    url: "https://discord.com/api/webhooks/…",
    matches: (u) => /(^|\.)discord(app)?\.com$/.test(u.hostname) && u.pathname.startsWith("/api/webhooks/"),
    headers: "",
    body: json({
      username: "Plex",
      content: "👀 New {{type}}!\n{{display_title}} was recently added to Plex.",
      embeds: [
        {
          title: "{{display_title}}",
          url: "{{plex_url}}",
          description: "{{Metadata.summary}}",
          color: 0xe5a00d,
          fields: [{ name: "View details", value: "[Plex Web]({{plex_url}})", inline: true }],
          image: { url: "attachment://poster.jpg" },
          footer: { text: "{{library}} · {{server}}" },
          timestamp: "{{timestamp}}",
        },
      ],
    }),
    attachPoster: true,
    events: ["library.new"],
  },
  {
    id: "slack",
    label: "Slack",
    url: "https://hooks.slack.com/services/…",
    matches: (u) => u.hostname === "hooks.slack.com",
    headers: "",
    body: json({
      text: "{{user}} {{action}} {{display_title}}",
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: "*<{{plex_url}}|{{display_title}}>*\n{{Metadata.summary}}" } },
        { type: "context", elements: [{ type: "mrkdwn", text: "*{{user}}* {{action}} on {{player}} · {{library}}" }] },
      ],
    }),
    attachPoster: false,
    events: ["media.play", "media.scrobble"],
  },
  {
    id: "ntfy",
    label: "ntfy",
    url: "https://ntfy.sh/your-topic",
    matches: (u) => u.hostname.split(".").includes("ntfy"),
    headers: [
      "Content-Type: text/plain",
      "Title: {{display_title}}",
      "Tags: tv",
      "Click: {{plex_url}}",
      "Attach: {{thumb_url}}",
    ].join("\n"),
    body: "{{user}} {{action}} on {{player}}",
    attachPoster: false,
    events: ["media.play", "media.scrobble"],
  },
  {
    id: "home-assistant",
    label: "Home Assistant",
    url: "http://homeassistant.local:8123/api/webhook/your-webhook-id",
    matches: (u) => u.pathname.startsWith("/api/webhook/"),
    headers: "",
    body: json({
      event: "{{event}}",
      action: "{{action}}",
      user: "{{user}}",
      user_id: "{{user_id}}",
      player: "{{player}}",
      player_local: "{{player_local}}",
      server: "{{server}}",
      title: "{{display_title}}",
      name: "{{title}}",
      show: "{{show}}",
      season: "{{season}}",
      episode: "{{episode}}",
      episode_code: "{{episode_code}}",
      year: "{{year}}",
      type: "{{type}}",
      library: "{{library}}",
      summary: "{{Metadata.summary}}",
      plex_url: "{{plex_url}}",
      poster_url: "{{thumb_url}}",
      timestamp: "{{timestamp}}",
    }),
    attachPoster: false,
  },
];

export function presetForUrl(raw: string): Preset | undefined {
  try {
    const url = new URL(raw.trim());
    return PRESETS.find((p) => p.matches(url));
  } catch {
    return undefined;
  }
}

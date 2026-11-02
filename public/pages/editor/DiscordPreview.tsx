import { useState, type ReactNode } from "react";
import "./DiscordPreview.css";

type Field = { name?: unknown; value?: unknown; inline?: unknown };
type Embed = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  color?: unknown;
  fields?: unknown;
  image?: { url?: unknown };
  thumbnail?: { url?: unknown };
  footer?: { text?: unknown };
  timestamp?: unknown;
};
export type DiscordMessage = { username?: unknown; content?: unknown; embeds?: unknown };

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function isDiscordMessage(v: unknown): v is DiscordMessage {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  return "content" in v || ("embeds" in v && Array.isArray((v as DiscordMessage).embeds));
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

function markdown(text: string): ReactNode[] {
  return text.split("\n").flatMap((line, i) => {
    const parts: ReactNode[] = i ? [<br key={`br${i}`} />] : [];
    line.split(INLINE).forEach((token, j) => {
      const key = `${i}-${j}`;
      if (!token) return;
      if (token.startsWith("**") && token.endsWith("**")) parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
      else if (token.startsWith("`") && token.endsWith("`")) parts.push(<code key={key}>{token.slice(1, -1)}</code>);
      else if (token.startsWith("*") && token.endsWith("*") && token.length > 2) parts.push(<em key={key}>{token.slice(1, -1)}</em>);
      else if (token.startsWith("[")) {
        const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token) ?? [];
        parts.push(
          <a key={key} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>,
        );
      } else parts.push(token);
    });
    return parts;
  });
}

function discordTime(date: Date): string {
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toDateString() === new Date().toDateString() ? `Today at ${time}` : `${date.toLocaleDateString()} ${time}`;
}

function imageSource(url: string, poster: string | null): string | null {
  if (url.startsWith("attachment://")) return poster;
  return /^https?:\/\//.test(url) ? url : null;
}

function Poster({ src }: { src: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <div className="dc-poster-placeholder">Poster</div>;
  return <img className="dc-image" src={src} alt="" onError={() => setMissing(true)} />;
}

function EmbedCard({ embed, poster }: { embed: Embed; poster: string | null }) {
  const title = str(embed.title);
  const url = str(embed.url);
  const description = str(embed.description);
  const fields = Array.isArray(embed.fields) ? (embed.fields as Field[]) : [];
  const image = imageSource(str(embed.image?.url), poster);
  const thumbnail = imageSource(str(embed.thumbnail?.url), poster);
  const footer = str(embed.footer?.text);
  const stamp = str(embed.timestamp);
  const date = stamp && !Number.isNaN(Date.parse(stamp)) ? new Date(stamp) : null;
  const color = typeof embed.color === "number" ? `#${embed.color.toString(16).padStart(6, "0")}` : undefined;

  return (
    <div className="dc-embed" style={color ? { borderLeftColor: color } : undefined}>
      <div className="dc-embed-grid">
        <div className="dc-embed-main">
          {title &&
            (url ? (
              <a className="dc-title" href={url} target="_blank" rel="noreferrer">
                {title}
              </a>
            ) : (
              <div className="dc-title">{title}</div>
            ))}
          {description && <div className="dc-description">{markdown(description)}</div>}
          {fields.length > 0 && (
            <div className="dc-fields">
              {fields.map((f, i) => (
                <div key={i} className={f.inline ? "dc-field inline" : "dc-field"}>
                  <div className="dc-field-name">{markdown(str(f.name))}</div>
                  <div className="dc-field-value">{markdown(str(f.value))}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {thumbnail && <Poster key={thumbnail} src={thumbnail} />}
      </div>
      {image && <Poster key={image} src={image} />}
      {(footer || date) && (
        <div className="dc-footer">
          {footer}
          {footer && date && " • "}
          {date && discordTime(date)}
        </div>
      )}
    </div>
  );
}

export function DiscordPreview({ message, poster }: { message: DiscordMessage; poster: string | null }) {
  const name = str(message.username) || "mediahooks";
  const content = str(message.content);
  const embeds = Array.isArray(message.embeds) ? (message.embeds as Embed[]) : [];
  return (
    <div className="dc">
      <div className="dc-avatar" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="dc-body">
        <div className="dc-header">
          <span className="dc-name">{name}</span>
          <span className="dc-app">APP</span>
          <span className="dc-time">{discordTime(new Date())}</span>
        </div>
        {content && <div className="dc-content">{markdown(content)}</div>}
        {embeds.map((e, i) => (
          <EmbedCard key={i} embed={e} poster={poster} />
        ))}
      </div>
    </div>
  );
}

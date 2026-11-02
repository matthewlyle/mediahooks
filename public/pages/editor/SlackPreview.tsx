import type { ReactNode } from "react";
import "./SlackPreview.css";

type TextObject = { type?: unknown; text?: unknown };
type ImageElement = { type: "image"; image_url?: unknown; alt_text?: unknown };
type Block = {
  type?: unknown;
  text?: TextObject;
  fields?: unknown;
  accessory?: ImageElement;
  elements?: unknown;
  image_url?: unknown;
  alt_text?: unknown;
};
export type SlackMessage = { username?: unknown; text?: unknown; blocks?: unknown };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const httpUrl = (v: unknown): string | null => (/^https?:\/\//.test(str(v)) ? str(v) : null);

export function isSlackMessage(v: unknown): v is SlackMessage {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const m = v as Record<string, unknown>;
  if (Array.isArray(m.blocks)) return true;
  return typeof m.text === "string" && !("content" in m) && !("embeds" in m);
}

const TOKEN = /(<[^>\n]+>|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function inline(text: string, key: string): ReactNode[] {
  return text.split(TOKEN).map((token, i): ReactNode => {
    const k = `${key}-${i}`;
    if (!token) return null;
    const inner = token.slice(1, -1);
    if (token.startsWith("<") && token.endsWith(">")) {
      const [target = "", label] = inner.split("|");
      const href = httpUrl(target);
      if (!href) return decode(label ?? (target.startsWith("@") || target.startsWith("#") ? target : token));
      return (
        <a key={k} href={href} target="_blank" rel="noreferrer">
          {decode(label ?? target)}
        </a>
      );
    }
    if (token.startsWith("*") && token.endsWith("*")) return <strong key={k}>{inline(inner, k)}</strong>;
    if (token.startsWith("_") && token.endsWith("_")) return <em key={k}>{inline(inner, k)}</em>;
    if (token.startsWith("~") && token.endsWith("~")) return <s key={k}>{inline(inner, k)}</s>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={k}>{decode(inner)}</code>;
    return decode(token);
  });
}

function mrkdwn(text: string): ReactNode[] {
  return text.split("\n").flatMap((line, i) => (i ? [<br key={`br${i}`} />, ...inline(line, `l${i}`)] : inline(line, "l0")));
}

function Text({ value }: { value: TextObject | undefined }) {
  const text = str(value?.text);
  if (!text) return null;
  return <>{value?.type === "plain_text" ? text : mrkdwn(text)}</>;
}

function Img({ url, alt, className }: { url: unknown; alt: unknown; className: string }) {
  const src = httpUrl(url);
  return src ? <img className={className} src={src} alt={str(alt)} /> : null;
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "header":
      return (
        <div className="sl-header">
          <Text value={{ ...block.text, type: "plain_text" }} />
        </div>
      );
    case "divider":
      return <hr className="sl-divider" />;
    case "image":
      return <Img className="sl-image" url={block.image_url} alt={block.alt_text} />;
    case "context": {
      const elements = Array.isArray(block.elements) ? (block.elements as (TextObject | ImageElement)[]) : [];
      return (
        <div className="sl-context">
          {elements.map((e, i) =>
            e.type === "image" ? (
              <Img key={i} className="sl-context-image" url={(e as ImageElement).image_url} alt={(e as ImageElement).alt_text} />
            ) : (
              <span key={i}>
                <Text value={e as TextObject} />
              </span>
            ),
          )}
        </div>
      );
    }
    case "section": {
      const fields = Array.isArray(block.fields) ? (block.fields as TextObject[]) : [];
      return (
        <div className="sl-section">
          <div className="sl-section-main">
            {block.text && (
              <div>
                <Text value={block.text} />
              </div>
            )}
            {fields.length > 0 && (
              <div className="sl-fields">
                {fields.map((f, i) => (
                  <div key={i}>
                    <Text value={f} />
                  </div>
                ))}
              </div>
            )}
          </div>
          {block.accessory?.type === "image" && (
            <Img className="sl-accessory" url={block.accessory.image_url} alt={block.accessory.alt_text} />
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

export function SlackPreview({ message }: { message: SlackMessage }) {
  const name = str(message.username) || "mediahooks";
  const blocks = Array.isArray(message.blocks) ? (message.blocks as Block[]) : [];
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div className="sl">
      <div className="sl-avatar" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="sl-body">
        <div className="sl-meta">
          <span className="sl-name">{name}</span>
          <span className="sl-app">APP</span>
          <span className="sl-time">{time}</span>
        </div>
        {blocks.length > 0 ? (
          blocks.map((b, i) => <BlockView key={i} block={b} />)
        ) : (
          <div className="sl-text">{mrkdwn(str(message.text))}</div>
        )}
      </div>
    </div>
  );
}

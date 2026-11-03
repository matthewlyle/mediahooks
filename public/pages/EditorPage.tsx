import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { matches, type Filters } from "../../src/filters.ts";
import type { SendResult } from "../../src/send.ts";
import type { IncomingEvent, PlexPayload, Webhook } from "../../src/types.ts";
import { SAMPLE_MOVIE_PAYLOAD, SAMPLE_PAYLOAD, SAMPLE_TRACK_PAYLOAD } from "../../src/sample.ts";
import { isJsonContentType, renderBody, renderHeaders, templateVars } from "../../src/template.ts";
import { Button, LinkButton } from "../ui/Button.tsx";
import { Segmented } from "../ui/Segmented.tsx";
import { burst } from "../components/burst.ts";
import { Spinner } from "../components/Spinner.tsx";
import { Switch } from "../components/Switch.tsx";
import { api, type Meta } from "../lib/api.ts";
import { EASE, SPRING, fadeIn, flash, ids, pageTransition } from "../lib/motion.ts";
import { useEscape, useNav, useRouteHeading } from "../lib/nav.ts";
import { useStore } from "../lib/store.tsx";
import { PRESETS, type Preset } from "../presets.ts";
import "./EditorPage.css";
import {
  EMPTY_FORM,
  FIELDS,
  applyPreset,
  fieldForServerError,
  parseHeaders,
  presetToApply,
  toForm,
  toInput,
  validateForm,
  type Field,
  type FieldErrors,
  type FormState,
} from "./editor/form.ts";
import { CodeEditor, type CodeEditorHandle } from "./editor/CodeEditor.tsx";
import { DiscordPreview, isDiscordMessage } from "./editor/DiscordPreview.tsx";
import { SlackPreview, isSlackMessage } from "./editor/SlackPreview.tsx";
import { EventSentence } from "./editor/EventSentence.tsx";
import { Reveal } from "./editor/Reveal.tsx";

const PANEL_MOTION = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE.css } },
  transition: SPRING.page,
} as const;

const DEFAULT_URL_PLACEHOLDER = "https://example.com/hook";

const PREVIEW_SAMPLES = { episode: SAMPLE_PAYLOAD, movie: SAMPLE_MOVIE_PAYLOAD, track: SAMPLE_TRACK_PAYLOAD } as const;
type Sample = keyof typeof PREVIEW_SAMPLES;

type PreviewSource = { payload: PlexPayload; poster: string | null; eventId: number | null };

function previewSource(recent: IncomingEvent[], kind: Sample, filters: Filters): PreviewSource {
  const ofKind = recent.filter((e) => e.payload.Metadata?.type === kind);
  const e = ofKind.find((x) => matches(filters, x.payload)) ?? ofKind[0];
  if (!e) return { payload: PREVIEW_SAMPLES[kind], poster: null, eventId: null };
  return { payload: e.payload, poster: e.thumbKey ? `/thumbs/${e.thumbKey}` : null, eventId: e.id };
}

export function EditorPage({ id, back: closeTo }: { id: number | null; back?: string }) {
  const navigate = useNav();
  const { meta, webhooks, loaded, error, upsert, setHighlight } = useStore();
  const w = id === null ? null : (webhooks.find((x) => x.id === id) ?? null);
  const [back] = useState(
    () =>
      closeTo ?? (id !== null && new URLSearchParams(location.search).get("from") === "detail" ? `/webhooks/${id}` : "/"),
  );
  const modal = closeTo !== undefined;
  const headingRef = useRouteHeading<HTMLHeadingElement>(!modal);
  useEscape(() => navigate(back, { instant: true }));

  const [saved, setSaved] = useState<Webhook | null>(null);
  const afterSave = modal ? "/" : back;
  useEffect(() => {
    if (saved) navigate(afterSave);
  }, [saved, afterSave, navigate]);

  function onSaved(hook: Webhook) {
    upsert(hook);
    if (afterSave === "/") setHighlight({ id: hook.id, tone: "accent" });
    setSaved(hook);
  }

  let missing: string | null = null;
  if (!loaded && error) missing = "Could not reach the mediahooks API.";
  else if (loaded && meta && id !== null && !w) missing = "No such webhook";
  const ready = loaded && meta && (id === null || w);

  // The heading sits outside the panel: a shared element must not have a fading ancestor.
  const heading = (
    <h2 ref={headingRef} tabIndex={-1} className="editor-title">
      {id === null ? (
        <motion.span {...fadeIn}>New webhook</motion.span>
      ) : (
        w && (
          <>
            <motion.span
              className="muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.22, duration: 0.2, ease: EASE.css } }}
            >
              Edit
            </motion.span>{" "}
            {/* Constant layoutDependency: the rename on save mustn't animate here, only the flight. */}
            <motion.span
              layoutId={ids.name(id)}
              layoutCrossfade={false}
              layoutDependency={0}
              transition={{ layout: SPRING.morph }}
            >
              {w.name}
            </motion.span>
          </>
        )
      )}
    </h2>
  );

  const body =
    ready && meta ? (
      <EditorForm id={id} w={w} meta={meta} back={back} onSaved={onSaved} heading={heading} focusName={modal} />
    ) : (
      <>
        {heading}
        {missing && (
          <motion.section className="panel editor" {...PANEL_MOTION}>
            <Missing text={missing} />
          </motion.section>
        )}
      </>
    );
  if (modal) return body;
  return (
    <motion.div className="page" {...pageTransition}>
      {body}
    </motion.div>
  );
}

function Missing({ text }: { text: string }) {
  return (
    <div className="editor-missing">
      <p className="muted">{text}</p>
      <LinkButton to="/">Back to webhooks</LinkButton>
    </div>
  );
}

type EditorFormProps = {
  id: number | null;
  w: Webhook | null;
  meta: Meta;
  back: string;
  onSaved: (w: Webhook) => void;
  heading: ReactNode;
  focusName: boolean;
};

const FIELD_OF: Partial<Record<keyof FormState, Field>> = {
  name: "name",
  url: "url",
  headers: "headers",
  allEvents: "events",
  events: "events",
  bodyTemplate: "bodyTemplate",
};

function resultLine(r: SendResult): { text: string; full: string } {
  const detail = r.ok ? `${r.durationMs}ms` : r.error?.replace(/\s+/g, " ").trim() || `${r.durationMs}ms`;
  const status = r.status ?? "ERR";
  return { text: `${r.ok ? "✓" : "✗"} ${status} · ${detail}`, full: `${status} · ${detail}` };
}

function FieldError({ id, error }: { id: string; error: string | undefined }) {
  return (
    <div className="reveal-region" role="status">
      <AnimatePresence initial={false}>
        {error && (
          <Reveal key="error">
            <p id={id} className="field-error">
              {error}
            </p>
          </Reveal>
        )}
      </AnimatePresence>
    </div>
  );
}

function EditorForm({ id, w, meta, back, onSaved, heading, focusName }: EditorFormProps) {
  const navigate = useNav();
  const reduce = useReducedMotion();
  const uid = useId();
  const formId = `${uid}-form`;
  const errId = (f: Field) => `${uid}-${f}-error`;
  const [form, setForm] = useState<FormState>(() => (w ? toForm(w) : EMPTY_FORM));
  const [urlPlaceholder, setUrlPlaceholder] = useState(DEFAULT_URL_PLACEHOLDER);
  const [sample, setSample] = useState<Sample>("episode");
  const [recent, setRecent] = useState<IncomingEvent[]>([]);
  const [view, setView] = useState<"rich" | "request">("rich");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingAnnounced, setSendingAnnounced] = useState(false);
  const [result, setResult] = useState<(SendResult & { n: number }) | null>(null);
  useEffect(() => {
    if (!sending) return setSendingAnnounced(false);
    // Announced after the button's own speech, which otherwise drops the live region update.
    const timer = setTimeout(() => setSendingAnnounced(true), 500);
    return () => clearTimeout(timer);
  }, [sending]);
  const [stuck, setStuck] = useState(false);

  const errors = useMemo(() => validateForm(form), [form]);
  const [touched, setTouched] = useState<ReadonlySet<Field>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const edited = useRef(new Set<Field>());
  const shown = (f: Field) => serverErrors[f] ?? (touched.has(f) ? errors[f] : undefined);
  const invalidProps = (f: Field) =>
    shown(f) ? { "aria-invalid": true, "aria-describedby": errId(f) } : { "aria-invalid": false };
  const [focusRequest, setFocusRequest] = useState<{ field: Field } | null>(null);

  const sentinel = useRef<HTMLDivElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const urlField = useRef<HTMLInputElement>(null);
  const headersEditor = useRef<CodeEditorHandle>(null);
  const bodyEditor = useRef<CodeEditorHandle>(null);
  const whatToken = useRef<HTMLSpanElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusName) nameField.current?.focus({ preventScroll: true });
  }, [focusName]);

  useEffect(() => {
    void api<IncomingEvent[]>("/api/events").then((res) => res.ok && setRecent(res.data));
  }, []);

  useEffect(() => {
    // Several entries can queue up; the last is the current state.
    const observer = new IntersectionObserver((entries) => setStuck(!entries.at(-1)!.isIntersecting));
    observer.observe(sentinel.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    const fields = { name: nameField, url: urlField, headers: headersEditor, events: whatToken, bodyTemplate: bodyEditor };
    const el = fields[focusRequest.field].current;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [focusRequest, reduce]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    const field = FIELD_OF[key];
    if (!field) return;
    edited.current.add(field);
    if (serverErrors[field]) setServerErrors(({ [field]: _, ...rest }) => rest);
  }

  const touch = (f: Field) => () => {
    if (edited.current.has(f) && !touched.has(f)) setTouched((t) => new Set(t).add(f));
  };

  const source = useMemo(
    () => previewSource(recent, sample, toInput(form, meta.events)),
    [recent, sample, form.allEvents, form.events, form.users, form.libraries, meta.events],
  );

  const preview = useMemo((): { text: string; headers: string; invalid: string | null; json?: unknown } => {
    const parsed = parseHeaders(form.headers);
    const headers = parsed.ok ? parsed.headers : {};
    const headersText = Object.entries(renderHeaders(headers, source.payload))
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const rendered = renderBody(form.bodyTemplate, source.payload, headers);
    if (!rendered || !isJsonContentType(headers)) return { text: rendered, headers: headersText, invalid: null };
    try {
      const json: unknown = JSON.parse(rendered);
      return { text: JSON.stringify(json, null, 2), headers: headersText, invalid: null, json };
    } catch (err) {
      return { text: rendered, headers: headersText, invalid: (err as Error).message };
    }
  }, [form.headers, form.bodyTemplate, source]);
  const bodyIsJson = useMemo(() => {
    const parsed = parseHeaders(form.headers);
    return isJsonContentType(parsed.ok ? parsed.headers : {});
  }, [form.headers]);
  const completionData = useMemo(() => ({ vars: templateVars(source.payload), payload: source.payload }), [source]);
  const discord = isDiscordMessage(preview.json) ? preview.json : null;
  const slack = !discord && isSlackMessage(preview.json) ? preview.json : null;
  const rich = discord ? "discord" : slack ? "slack" : null;
  const richShown = view === "rich" ? rich : null;

  const [templateId, setTemplateId] = useState(
    () => PRESETS.find((p) => p.body === form.bodyTemplate && p.headers === form.headers)?.id ?? "custom",
  );
  const activeTemplate =
    PRESETS.find((p) => p.id === templateId && p.body === form.bodyTemplate && p.headers === form.headers)?.id ?? "custom";

  const headerCount = form.headers.split("\n").filter((line) => line.trim()).length;
  const headersSummary = headerCount ? `${headerCount} header${headerCount === 1 ? "" : "s"}` : "none";

  function check(): boolean {
    setServerErrors({});
    setTouched(new Set(FIELDS));
    if (errors.headers) setOptionsOpen(true);
    const first = FIELDS.find((f) => errors[f]);
    if (first) setFocusRequest({ field: first });
    return !first;
  }

  function showFormError(message: string) {
    if (formError !== null) flash(errorBox.current, "error");
    setFormError(message);
  }

  function showRequestError(status: number, message: string) {
    const mapped = status === 400 ? fieldForServerError(message) : null;
    if (!mapped) return showFormError(message);
    setFormError(null);
    setServerErrors({ [mapped.field]: mapped.error });
    if (mapped.field === "headers") setOptionsOpen(true);
    setFocusRequest({ field: mapped.field });
  }

  function fillPreset(p: Preset) {
    setForm((f) => applyPreset(f, p));
    setTemplateId(p.id);
    setUrlPlaceholder(p.url);
    flash(bodyEditor.current?.dom);
    if (p.headers) flash(headersEditor.current?.dom);
  }

  function clearTemplate() {
    const cleared: Field[] = ["name", "url", "headers", "bodyTemplate"];
    setForm((f) => ({ ...f, name: "", url: "", headers: "", bodyTemplate: "", attachPoster: false }));
    setTemplateId("custom");
    setUrlPlaceholder(DEFAULT_URL_PLACEHOLDER);
    for (const f of cleared) edited.current.delete(f);
    setTouched((t) => new Set([...t].filter((f) => !cleared.includes(f))));
    setServerErrors((e) => Object.fromEntries(Object.entries(e).filter(([f]) => !cleared.includes(f as Field))));
    nameField.current?.focus();
  }

  function onTemplateChange(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return clearTemplate();
    fillPreset(p);
    if (!form.url) urlField.current?.focus();
  }

  function onUrlChange(url: string) {
    const p = presetToApply(form, url);
    set("url", url);
    if (p) fillPreset(p);
  }

  function insertVariable(name: string) {
    bodyEditor.current?.insert(`{{${name}}}`);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (saving || !check()) return;
    setSaving(true);
    const res = await api<Webhook>(id === null ? "/api/webhooks" : `/api/webhooks/${id}`, {
      method: id === null ? "POST" : "PUT",
      body: JSON.stringify(toInput(form, meta.events)),
    });
    setSaving(false);
    if (!res.ok) return showRequestError(res.status, res.error);
    setFormError(null);
    onSaved(res.data);
  }

  async function onSendTest() {
    if (sending || !check()) return;
    setSending(true);
    const res = await api<SendResult>("/api/send-test", {
      method: "POST",
      body: JSON.stringify({ ...toInput(form, meta.events), id, eventId: source.eventId }),
    });
    setSending(false);
    if (!res.ok) return showRequestError(res.status, res.error);
    setFormError(null);
    setResult((r) => ({ ...res.data, n: (r?.n ?? 0) + 1 }));
    if (res.data.ok) burst(sendButton.current);
  }

  const line = result && resultLine(result);

  function onAllEvents(on: boolean) {
    set("allEvents", on);
    setTouched((t) => new Set(t).add("events"));
  }

  function onToggleEvent(id: string) {
    set("events", form.events.includes(id) ? form.events.filter((x) => x !== id) : [...form.events, id]);
    setTouched((t) => new Set(t).add("events"));
  }

  return (
    <>
      <div ref={sentinel} className="editor-bar-sentinel" aria-hidden="true" />
      <div className="editor-bar" data-stuck={stuck || undefined}>
        <div className="bar-lead">
          {heading}
          <select
            className="template-picker"
            aria-label="Template"
            value={activeTemplate}
            onChange={(e) => onTemplateChange(e.target.value)}
          >
            <option value="custom">Custom</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <motion.div className="form-actions" {...fadeIn}>
          <span className="bar-enabled">
            <span aria-hidden="true" onClick={() => set("enabled", !form.enabled)}>
              Enabled
            </span>
            <Switch checked={form.enabled} onChange={(on) => set("enabled", on)} label="Enabled" />
          </span>
          <Button
            ref={sendButton}
            className="test-btn send-test"
            onClick={onSendTest}
          >
            <span className="send-test-label">Send test</span>
            {sending && (
              <span className="send-test-busy" aria-hidden="true">
                {reduce ? "Sending…" : <Spinner />}
              </span>
            )}
          </Button>
          <Button onClick={() => navigate(back)}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" disabled={saving}>
            Save
          </Button>
        </motion.div>
        <p className="sr-only" role="status">
          {sending ? (sendingAnnounced ? "Sending test…" : "") : result && line ? `${result.ok ? "Test delivered" : "Test failed"}: ${line.full}` : ""}
        </p>
        <AnimatePresence initial={false}>
          {result && line && (
            <Reveal key="result">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={result.n}
                  className={`send-result ${result.ok ? "ok" : "fail"}`}
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.15, ease: EASE.css } }}
                  exit={{ opacity: 0, transition: { duration: 0.08, ease: EASE.css } }}
                >
                  {line.text}
                </motion.p>
              </AnimatePresence>
            </Reveal>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {formError !== null && (
            <Reveal key="error">
              <div ref={errorBox} className="form-error" role="alert">
                {formError}
              </div>
            </Reveal>
          )}
        </AnimatePresence>
      </div>

      <motion.form id={formId} className="panel editor" onSubmit={onSave} noValidate {...PANEL_MOTION}>
        <div className="editor-section">
          <div className="row row-destination">
            <div className="field">
              <label htmlFor={`${uid}-name`}>
                <span className="field-name">
                  Name <span className="required">required</span>
                </span>
              </label>
              <input
                ref={nameField}
                id={`${uid}-name`}
                name="name"
                required
                autoComplete="off"
                data-1p-ignore=""
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={touch("name")}
                {...invalidProps("name")}
              />
              <FieldError id={errId("name")} error={shown("name")} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-url`}>
                <span className="field-name">
                  URL <span className="required">required</span>
                </span>
              </label>
              <input
                ref={urlField}
                id={`${uid}-url`}
                name="url"
                type="url"
                required
                autoComplete="off"
                placeholder={urlPlaceholder}
                value={form.url}
                onChange={(e) => onUrlChange(e.target.value)}
                onBlur={touch("url")}
                {...invalidProps("url")}
              />
              <FieldError id={errId("url")} error={shown("url")} />
            </div>
          </div>
        </div>

        <div className="editor-section">
          <EventSentence
            available={meta.events}
            allEvents={form.allEvents}
            events={form.events}
            users={form.users}
            libraries={form.libraries}
            onAllEvents={onAllEvents}
            onToggle={onToggleEvent}
            onUsers={(v) => set("users", v)}
            onLibraries={(v) => set("libraries", v)}
            whatRef={whatToken}
            invalid={Boolean(shown("events"))}
            describedBy={shown("events") ? errId("events") : undefined}
          />
          <FieldError id={errId("events")} error={shown("events")} />
        </div>

        <div className="editor-section">
          <div className="options">
            <button
              type="button"
              id={`${uid}-headers-toggle`}
              className="disclosure"
              aria-expanded={optionsOpen}
              aria-controls={`${uid}-options`}
              onClick={() => setOptionsOpen((open) => !open)}
            >
              Headers <span className="disclosure-summary">{headersSummary}</span>
            </button>
            <div id={`${uid}-options`}>
              <AnimatePresence initial={false}>
                {optionsOpen && (
                  <Reveal key="options">
                    <div className="field options-body">
                      <CodeEditor
                        ref={headersEditor}
                        id={`${uid}-headers`}
                        className="headers-editor"
                        ariaLabelledBy={`${uid}-headers-toggle`}
                        ariaDescribedBy={shown("headers") ? errId("headers") : undefined}
                        invalid={Boolean(shown("headers"))}
                        language="plain"
                        completions={completionData}
                        placeholder={"Authorization: Bearer …\nTitle: {{display_title}}"}
                        value={form.headers}
                        onChange={(v) => set("headers", v)}
                        onBlur={touch("headers")}
                      />
                      <FieldError id={errId("headers")} error={shown("headers")} />
                    </div>
                  </Reveal>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="message-grid">
            <div className="field">
              <label id={`${uid}-body-label`} onClick={() => bodyEditor.current?.focus()}>
                <span className="field-name">
                  Body <span className="optional">optional</span>
                </span>
              </label>
              <CodeEditor
                ref={bodyEditor}
                id={`${uid}-body`}
                ariaLabelledBy={`${uid}-body-label`}
                ariaDescribedBy={shown("bodyTemplate") ? errId("bodyTemplate") : undefined}
                invalid={Boolean(shown("bodyTemplate"))}
                language={bodyIsJson ? "json" : "plain"}
                completions={completionData}
                placeholder='{"content": "{{user}} {{action}} {{display_title}}"}'
                value={form.bodyTemplate}
                onChange={(v) => set("bodyTemplate", v)}
                onBlur={touch("bodyTemplate")}
              />
              <FieldError id={errId("bodyTemplate")} error={shown("bodyTemplate")} />
              <div className="vars">
                <button
                  type="button"
                  className="disclosure"
                  aria-expanded={varsOpen}
                  aria-controls={`${uid}-vars`}
                  onClick={() => setVarsOpen((open) => !open)}
                >
                  Template variables
                </button>
                <div id={`${uid}-vars`}>
                  <AnimatePresence initial={false}>
                    {varsOpen && (
                      <Reveal key="vars">
                        <div className="var-chips" role="group" aria-label="Insert a variable">
                          {meta.templateVars.map((v) => (
                            <Button
                              key={v}
                              className="var-chip"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => insertVariable(v)}
                            >
                              {`{{${v}}}`}
                            </Button>
                          ))}
                        </div>
                        <p className="vars-hint">
                          Payload paths work too, like <code>{"{{Metadata.summary}}"}</code>.
                        </p>
                      </Reveal>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {(discord !== null || form.attachPoster) && (
                  <Reveal key="poster">
                    <label className="inline poster-option">
                      <input
                        type="checkbox"
                        checked={form.attachPoster}
                        onChange={(e) => set("attachPoster", e.target.checked)}
                      />
                      <span className="poster-label">Attach poster</span>
                      <span className="optional">sent as a file, Discord's format</span>
                    </label>
                  </Reveal>
                )}
              </AnimatePresence>
            </div>
            <div className="preview">
              <div className="preview-head">
                <Segmented
                  label="Preview with"
                  options={[
                    ["episode", "Episode"],
                    ["movie", "Movie"],
                    ["track", "Music"],
                  ]}
                  value={sample}
                  onChange={setSample}
                />
                {rich && (
                  <Segmented
                    label="Show as"
                    className="preview-view"
                    options={[
                      ["rich", "Preview"],
                      ["request", "Request"],
                    ]}
                    value={view}
                    onChange={setView}
                  />
                )}
                <AnimatePresence initial={false}>
                  {preview.invalid !== null && (
                    <motion.span
                      key="invalid"
                      className="preview-error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE.css } }}
                      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE.css } }}
                    >
                      Not valid JSON
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={richShown ?? "request"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.15, ease: EASE.css } }}
                  exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE.css } }}
                >
                  {richShown === "discord" && discord ? (
                    <DiscordPreview message={discord} poster={form.attachPoster ? source.poster : null} />
                  ) : richShown === "slack" && slack ? (
                    <SlackPreview message={slack} />
                  ) : (
                    <pre className="preview-body mono">
                      {preview.headers && <span className="preview-headers">{`${preview.headers}\n\n`}</span>}
                      {preview.text}
                    </pre>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.form>
    </>
  );
}

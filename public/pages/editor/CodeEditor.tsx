import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json, jsonLanguage } from "@codemirror/lang-json";
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { linter, type Diagnostic } from "@codemirror/lint";
import { Annotation, Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  keymap,
  placeholder as placeholderExt,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react";
import "./CodeEditor.css";

export type CodeEditorHandle = {
  readonly dom: HTMLElement | null;
  focus(options?: FocusOptions): void;
  scrollIntoView(arg?: ScrollIntoViewOptions): void;
  insert(text: string): void;
};

export type CompletionData = { vars: Record<string, unknown>; payload: unknown };

export type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language: "json" | "plain";
  completions: CompletionData;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  onBlur?: () => void;
  className?: string;
};

const PLACEHOLDER = /\{\{[^{}\n]*\}\}/g;
const External = Annotation.define<boolean>();

function describe(v: unknown): string {
  if (v === undefined || v === null || v === "") return "empty";
  const text = typeof v === "string" ? v : JSON.stringify(v);
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

function flatten(value: unknown, prefix: string, out: [string, unknown][]): [string, unknown][] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) {
    out.push([prefix, value]);
  }
  return out;
}

function applyName(name: string): Completion["apply"] {
  return (view, _completion, from, to) => {
    const closed = view.state.sliceDoc(to, to + 2) === "}}";
    const insert = closed ? name : `${name}}}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + name.length + 2 },
      userEvent: "input.complete",
    });
  };
}

function placeholderSource(data: () => CompletionData) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const match = ctx.matchBefore(/\{\{\s*[\w.]*$/);
    if (!match) return null;
    const from = match.from + /^\{\{\s*/.exec(match.text)![0].length;
    const typed = ctx.state.sliceDoc(from, ctx.pos);
    const { vars, payload } = data();
    const paths = flatten(payload, "", []);
    let options: Completion[];
    if (!typed.includes(".")) {
      const namespaces = [...new Set(paths.filter(([p]) => p.includes(".")).map(([p]) => p.split(".")[0]!))];
      options = [
        ...Object.entries(vars).map(([name, v]) => ({
          label: name,
          detail: describe(v),
          type: "variable",
          apply: applyName(name),
        })),
        ...namespaces.map((ns) => ({
          label: `${ns}.`,
          detail: "payload",
          type: "namespace",
          boost: -1,
          apply: (view: EditorView, _c: Completion, f: number, t: number) => {
            view.dispatch({ changes: { from: f, to: t, insert: `${ns}.` }, selection: { anchor: f + ns.length + 1 } });
            startCompletion(view);
          },
        })),
      ];
    } else {
      const scope = typed.slice(0, typed.lastIndexOf(".") + 1);
      options = paths
        .filter(([p]) => p.startsWith(scope))
        .map(([p, v]) => ({ label: p, detail: describe(v), type: "property", apply: applyName(p) }));
    }
    return { from, options, validFor: /^\w*$/ };
  };
}

function masked(text: string): string {
  return text.replace(PLACEHOLDER, (m) => `1${"0".repeat(m.length - 1)}`);
}

function firstErrorPos(text: string): number | null {
  let pos: number | null = null;
  jsonLanguage.parser.parse(text).iterate({
    enter: (node) => {
      if (pos !== null) return false;
      if (node.type.isError) pos = node.from;
    },
  });
  return pos;
}

const jsonLint = linter(
  (view) => {
    const text = view.state.doc.toString();
    if (!text.trim()) return [];
    const source = masked(text);
    try {
      JSON.parse(source);
      return [];
    } catch (err) {
      const message = (err as Error).message;
      const at = /position (\d+)/.exec(message);
      const pos = Math.min(at ? Number(at[1]) : (firstErrorPos(source) ?? text.length), text.length);
      const from = Math.max(0, pos === text.length ? pos - 1 : pos);
      const diagnostic: Diagnostic = { from, to: Math.min(text.length, from + 1), severity: "error", message };
      return [diagnostic];
    }
  },
  { delay: 300 },
);

const closePlaceholder = Prec.high(
  EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== "{" || from !== to || view.state.sliceDoc(from - 1, from) !== "{") return false;
    const close = view.state.sliceDoc(to, to + 1) === "}" ? "}" : "}}";
    view.dispatch({
      changes: { from, to, insert: `{${close}` },
      selection: { anchor: from + 1 },
      userEvent: "input.type",
    });
    startCompletion(view);
    return true;
  }),
);

const placeholderMarks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    matcher = new MatchDecorator({ regexp: PLACEHOLDER, decoration: Decoration.mark({ class: "cm-template-var" }) });
    constructor(view: EditorView) {
      this.decorations = this.matcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = this.matcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "#67e8f9" },
  { tag: tags.string, color: "#e3e9f2" },
  { tag: [tags.number, tags.bool, tags.null], color: "#f5c46b" },
  { tag: [tags.punctuation, tags.separator, tags.brace, tags.squareBracket], color: "#7a8396" },
]);

const theme = EditorView.theme(
  {
    "&": { color: "var(--fg)", backgroundColor: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "2px" },
    ".cm-content": { fontFamily: "var(--mono)", fontSize: "12px", padding: "7px 0", caretColor: "var(--accent)" },
    ".cm-line": { padding: "0 10px" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(34, 211, 238, 0.22) !important",
    },
    ".cm-placeholder": { color: "var(--muted)" },
    ".cm-tooltip": { backgroundColor: "var(--surface)", border: "none", borderRadius: "2px", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)" },
    ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--mono)", fontSize: "12px", maxHeight: "16em" },
    ".cm-tooltip-autocomplete > ul > li": { padding: "3px 10px" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent-dim)", color: "var(--accent)" },
    ".cm-completionDetail": { color: "var(--muted)", fontStyle: "normal", marginLeft: "12px" },
    ".cm-completionIcon": { display: "none" },
    ".cm-diagnostic": { fontFamily: "var(--mono)", fontSize: "12px", padding: "6px 10px" },
    ".cm-diagnostic-error": { borderLeft: "none", color: "var(--error)" },
  },
  { dark: true },
);

function languageExtension(language: "json" | "plain"): Extension {
  return language === "json" ? [json(), jsonLint] : [];
}

function contentAttributes(p: CodeEditorProps): Record<string, string> {
  const attrs: Record<string, string> = { "aria-multiline": "true", spellcheck: "false" };
  if (p.id) attrs.id = p.id;
  if (p.ariaLabel) attrs["aria-label"] = p.ariaLabel;
  if (p.ariaLabelledBy) attrs["aria-labelledby"] = p.ariaLabelledBy;
  if (p.ariaDescribedBy) attrs["aria-describedby"] = p.ariaDescribedBy;
  attrs["aria-invalid"] = p.invalid ? "true" : "false";
  return attrs;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const compartments = useRef({ language: new Compartment(), placeholder: new Compartment(), attrs: new Compartment() });

  useEffect(() => {
    const c = compartments.current;
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: latest.current.value,
        extensions: [
          history(),
          closePlaceholder,
          closeBrackets(),
          bracketMatching(),
          indentOnInput(),
          autocompletion({
            override: [placeholderSource(() => latest.current.completions)],
            icons: false,
            activateOnTyping: true,
          }),
          keymap.of([...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          syntaxHighlighting(highlight),
          placeholderMarks,
          theme,
          c.language.of(languageExtension(latest.current.language)),
          c.placeholder.of(placeholderExt(latest.current.placeholder ?? "")),
          c.attrs.of(EditorView.contentAttributes.of(contentAttributes(latest.current))),
          EditorView.updateListener.of((u) => {
            const external = u.transactions.some((t) => t.annotation(External));
            if (u.docChanged && !external) latest.current.onChange(u.state.doc.toString());
            if (u.focusChanged && !u.view.hasFocus) latest.current.onBlur?.();
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    const next = props.value;
    if (current === next) return;
    let start = 0;
    while (start < current.length && start < next.length && current[start] === next[start]) start++;
    let endA = current.length;
    let endB = next.length;
    while (endA > start && endB > start && current[endA - 1] === next[endB - 1]) {
      endA--;
      endB--;
    }
    v.dispatch({ changes: { from: start, to: endA, insert: next.slice(start, endB) }, annotations: External.of(true) });
  }, [props.value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.language.reconfigure(languageExtension(props.language)),
    });
  }, [props.language]);

  useEffect(() => {
    view.current?.dispatch({ effects: compartments.current.placeholder.reconfigure(placeholderExt(props.placeholder ?? "")) });
  }, [props.placeholder]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.attrs.reconfigure(EditorView.contentAttributes.of(contentAttributes(props))),
    });
  }, [props.id, props.ariaLabel, props.ariaLabelledBy, props.ariaDescribedBy, props.invalid]);

  useImperativeHandle(
    ref,
    () => ({
      get dom() {
        return view.current?.dom ?? null;
      },
      focus: () => view.current?.focus(),
      scrollIntoView: (arg) => view.current?.dom.scrollIntoView(arg),
      insert(text) {
        const v = view.current;
        if (!v) return;
        v.dispatch(v.state.replaceSelection(text), { scrollIntoView: true, userEvent: "input" });
        v.focus();
      },
    }),
    [],
  );

  return (
    <div
      ref={host}
      className={["code-editor", props.invalid && "is-invalid", props.className].filter(Boolean).join(" ")}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Escape") e.preventDefault();
      }}
    />
  );
});

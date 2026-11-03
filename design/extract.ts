import ts from "typescript";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type Prop = {
  name: string;
  type: string;
  options?: string[];
  required: boolean;
  default?: string;
  doc?: string;
};

export type Component = {
  name: string;
  file: string;
  doc?: string;
  props: Prop[];
  inherits: string[];
};

export type Token = { name: string; value: string; doc?: string };

export type Extracted = {
  components: Component[];
  cssTokens: Token[];
  motionTokens: Token[];
};

export type Sources = { uiDir: string; tokensCss: string; motionTs: string };

export const defaultSources: Sources = {
  uiDir: resolve(import.meta.dir, "../public/ui"),
  tokensCss: resolve(import.meta.dir, "../public/ui/tokens.css"),
  motionTs: resolve(import.meta.dir, "../public/lib/motion.ts"),
};

function listTsx(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function doc(symbol: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
  return text || undefined;
}

function unwrap(node: ts.Node | undefined): ts.Node | undefined {
  while (node) {
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) node = node.expression;
    else if (ts.isCallExpression(node) && node.arguments[0]) node = node.arguments[0];
    else break;
  }
  return node;
}

function defaultsOf(decl: ts.Declaration | undefined): Map<string, string> {
  const defaults = new Map<string, string>();
  let fn: ts.Node | undefined = decl;
  if (decl && ts.isVariableDeclaration(decl)) fn = unwrap(decl.initializer);
  if (!fn || !(ts.isFunctionLike(fn) && "parameters" in fn)) return defaults;
  const first = (fn as ts.SignatureDeclaration).parameters[0];
  if (!first || !ts.isObjectBindingPattern(first.name)) return defaults;
  for (const el of first.name.elements) {
    if (!el.initializer || el.dotDotDotToken) continue;
    const key = el.propertyName ?? el.name;
    if (ts.isIdentifier(key) || ts.isStringLiteral(key)) defaults.set(key.text, el.initializer.getText());
  }
  return defaults;
}

function literalOptions(type: ts.Type): string[] | undefined {
  const members = type.isUnion() ? type.types : [type];
  const literals = members.filter((t) => t.isStringLiteral()).map((t) => (t as ts.StringLiteralType).value);
  return literals.length > 1 ? literals : undefined;
}

function inheritedLabel(sym: ts.Symbol, propsTypeText: string): string {
  const file = sym.declarations?.[0]?.getSourceFile().fileName ?? "";
  if (/motion|framer/.test(file)) return "motion";
  const tag = propsTypeText.match(/<\s*"([a-z0-9]+)"\s*>/)?.[1];
  if (tag) return `<${tag}>`;
  const attrs = (sym.declarations?.[0]?.parent as ts.InterfaceDeclaration | undefined)?.name?.text;
  const m = attrs?.match(/^(\w+?)HTMLAttributes$/);
  if (m?.[1]) return `<${m[1].toLowerCase()}>`;
  return "DOM";
}

function collectComponents(uiDir: string): Component[] {
  const files = listTsx(uiDir);
  if (!files.length) return [];
  const configPath = ts.findConfigFile(uiDir, ts.sys.fileExists, "tsconfig.json");
  const options: ts.CompilerOptions = configPath
    ? ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, resolve(configPath, "..")).options
    : { jsx: ts.JsxEmit.ReactJSX, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, strict: true };
  const program = ts.createProgram(files, { ...options, noEmit: true });
  const checker = program.getTypeChecker();
  const out: Component[] = [];

  for (const file of files) {
    const sf = program.getSourceFile(file);
    const mod = sf && checker.getSymbolAtLocation(sf);
    if (!sf || !mod) continue;
    const exports = checker.getExportsOfModule(mod).sort((a, b) => (a.declarations?.[0]?.pos ?? 0) - (b.declarations?.[0]?.pos ?? 0));
    for (const exp of exports) {
      if (!/^[A-Z]/.test(exp.name)) continue;
      const target = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
      const decl = target.valueDeclaration;
      if (!decl) continue;
      const type = checker.getTypeOfSymbolAtLocation(target, decl);
      const sig = type.getCallSignatures()[0];
      if (!sig) continue;
      const param = sig.getParameters()[0];
      const propsType = param ? checker.getTypeOfSymbolAtLocation(param, decl) : undefined;
      const defaults = defaultsOf(decl);
      const paramDecl = param?.valueDeclaration;
      const propsText = propsType?.aliasSymbol?.declarations?.[0]?.getText() ?? (paramDecl && ts.isParameter(paramDecl) ? (paramDecl.type?.getText() ?? "") : "");
      const props: Prop[] = [];
      const inherits = new Set<string>();
      for (const p of propsType ? checker.getPropertiesOfType(propsType) : []) {
        const declFile = p.declarations?.[0]?.getSourceFile().fileName;
        if (!declFile || declFile.includes("/node_modules/")) {
          inherits.add(inheritedLabel(p, propsText));
          continue;
        }
        const pt = checker.getTypeOfSymbolAtLocation(p, p.declarations![0]!);
        const required = !(p.flags & ts.SymbolFlags.Optional);
        const nonNull = required ? pt : pt.getNonNullableType();
        const prop: Prop = {
          name: p.name,
          type: checker.typeToString(nonNull, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope),
          required,
        };
        const opts = literalOptions(nonNull);
        if (opts) prop.options = opts;
        const def = defaults.get(p.name);
        if (def !== undefined) prop.default = def;
        const d = doc(p, checker);
        if (d) prop.doc = d;
        props.push(prop);
      }
      const c: Component = { name: exp.name, file: file.slice(file.indexOf("public/")), props, inherits: [...inherits].filter((l) => l !== "DOM" || inherits.size === 1).sort() };
      const d = doc(target, checker);
      if (d) c.doc = d;
      out.push(c);
    }
  }
  return out;
}

export function parseTokensCss(css: string): Token[] {
  const tokens: Token[] = [];
  const re = /(?:\/\*([\s\S]*?)\*\/\s*)?(--[\w-]+)\s*:\s*([^;]+);(?:[ \t]*\/\*([\s\S]*?)\*\/)?/g;
  for (const m of css.matchAll(re)) {
    const comment = (m[4] ?? m[1])?.replace(/\s*\n\s*\*?\s*/g, " ").trim();
    const t: Token = { name: m[2]!, value: m[3]!.trim() };
    if (comment) t.doc = comment;
    tokens.push(t);
  }
  return tokens;
}

export function parseMotionExports(file: string): Token[] {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true);
  const tokens: Token[] = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st) || !st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const jsDoc = ts
      .getJSDocCommentsAndTags(st)
      .filter(ts.isJSDoc)
      .map((j) => (typeof j.comment === "string" ? j.comment : (j.comment?.map((c) => c.text).join("") ?? "")))
      .join("\n")
      .trim();
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      const init = d.initializer;
      const value = ts.isAsExpression(init) ? init.expression.getText() : init.getText();
      const t: Token = { name: d.name.text, value };
      if (jsDoc) t.doc = jsDoc;
      tokens.push(t);
    }
  }
  return tokens;
}

export function extract(sources: Sources = defaultSources): Extracted {
  const read = (f: string) => {
    try {
      return readFileSync(f, "utf8");
    } catch {
      return "";
    }
  };
  return {
    components: collectComponents(sources.uiDir),
    cssTokens: parseTokensCss(read(sources.tokensCss)),
    motionTokens: parseMotionExports(sources.motionTs),
  };
}

if (import.meta.main) console.log(JSON.stringify(extract(), null, 2));

export function emulateReduced(media: string): string {
  return media
    .replace(/\(\s*prefers-reduced-motion\s*(?::\s*reduce\s*)?\)/gi, "(min-width: 0px)")
    .replace(/\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/gi, "(max-width: 0px)");
}

function rewriteRules(rules: CSSRuleList): void {
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule && /prefers-reduced-motion/i.test(rule.media.mediaText)) {
      rule.media.mediaText = emulateReduced(rule.media.mediaText);
    }
    if ("cssRules" in rule) rewriteRules((rule as CSSGroupingRule).cssRules);
  }
}

export function rewriteSheets(doc: Document): void {
  for (const sheet of doc.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    rewriteRules(rules);
  }
}

if (typeof location !== "undefined" && new URLSearchParams(location.search).has("reduced")) {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q: string) => real(emulateReduced(q));
}

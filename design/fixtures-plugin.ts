import type { BunPlugin } from "bun";
import { resolve } from "node:path";

const dir = resolve(import.meta.dir, "fixtures");

const plugin: BunPlugin = {
  name: "design-fixtures",
  setup(build) {
    build.onResolve({ filter: /^design:fixtures$/ }, () => ({ path: "design:fixtures", namespace: "design-fixtures" }));
    build.onLoad({ filter: /.*/, namespace: "design-fixtures" }, () => {
      const names = [...new Bun.Glob("*.tsx").scanSync(dir)].map((f) => f.slice(0, -4)).sort();
      const contents = [
        ...names.map((n, i) => `import f${i} from ${JSON.stringify(`${dir}/${n}.tsx`)};`),
        `export const fixtures = { ${names.map((n, i) => `${JSON.stringify(n)}: f${i}`).join(", ")} };`,
      ].join("\n");
      return { contents, loader: "js" };
    });
  },
};

export default plugin;

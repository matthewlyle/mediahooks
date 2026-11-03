import index from "./index.html";
import { extract } from "./extract.ts";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8790),
  development: true,
  routes: {
    "/api/extracted": () => Response.json(extract()),
    "/*": index,
  },
});

console.log(`design playground on ${server.url}`);

import { execFileSync } from "node:child_process";

const FIND = `
const net = require("node:net");
const n = Number(process.argv[1]);
const servers = [];
let ports = [];
(function next() {
  if (ports.length === n) return servers.forEach((s) => s.close()), console.log(ports.join(","));
  const s = net.createServer().listen(0, () => {
    servers.push(s);
    ports.push(s.address().port);
    next();
  });
})();
`;

export function freePorts(key: string, count: number): number[] {
  const saved = process.env[key];
  if (saved) return saved.split(",").map(Number);
  const found = execFileSync(process.execPath, ["-e", FIND, String(count)], { encoding: "utf8" }).trim();
  process.env[key] = found;
  return found.split(",").map(Number);
}

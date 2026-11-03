declare module "design:fixtures" {
  import type { Fixture } from "./fixture.ts";
  export const fixtures: Record<string, Fixture>;
}

import { TableHead } from "../../public/ui/Table.tsx";
import type { Fixture } from "../fixture.ts";

export default { component: TableHead, group: "Data", props: { children: "Column labels" } } satisfies Fixture;

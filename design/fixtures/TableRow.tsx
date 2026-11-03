import { useEffect, useState } from "react";
import { TableRow, type TableRowProps } from "../../public/ui/Table.tsx";
import type { Fixture } from "../fixture.ts";

function TableRowDemo({ open: controlled, ...props }: TableRowProps) {
  const [open, setOpen] = useState(controlled);
  useEffect(() => setOpen(controlled), [controlled]);
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, width: 480 }}>
      <TableRow {...props} open={open} onToggle={() => setOpen((o) => !o)} />
    </ul>
  );
}

export default {
  component: TableRowDemo,
  group: "Data",
  props: { open: false, detailId: "demo-row-detail", fresh: false, summary: "200 · 124 ms", detail: "Request and response details appear here." },
} satisfies Fixture;

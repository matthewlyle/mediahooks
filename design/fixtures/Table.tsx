import { useState } from "react";
import { Table, TableRow } from "../../public/ui/Table.tsx";
import type { Fixture } from "../fixture.ts";

type DemoProps = { head: string; summary: string; detail: string; rows: number };

function TableDemo({ head, summary, detail, rows }: DemoProps) {
  const [openRow, setOpenRow] = useState<number | null>(null);
  return (
    <div style={{ width: 480 }}>
      <Table head={head || undefined}>
        {Array.from({ length: rows }, (_, i) => (
          <TableRow
            key={i}
            open={openRow === i}
            onToggle={() => setOpenRow(openRow === i ? null : i)}
            detailId={`demo-table-${i}`}
            summary={`${summary} ${i + 1}`}
            detail={detail}
          />
        ))}
      </Table>
    </div>
  );
}

export default { component: TableDemo, props: { head: "Result", summary: "200 · 124 ms", detail: "Request and response details appear here.", rows: 3 } } satisfies Fixture;

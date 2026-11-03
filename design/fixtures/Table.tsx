import { useState } from "react";
import { Table, TableRow, type TableProps } from "../../public/ui/Table.tsx";
import type { Fixture } from "../fixture.ts";

function TableDemo({ children, ...props }: TableProps) {
  const [openRow, setOpenRow] = useState<number | null>(null);
  return (
    <div style={{ width: 480 }}>
      <Table {...props}>
        {[0, 1, 2].map((i) => (
          <TableRow
            key={i}
            open={openRow === i}
            onToggle={() => setOpenRow(openRow === i ? null : i)}
            detailId={`demo-table-${i}`}
            summary={`${children ?? ""} ${i + 1}`}
            detail="Request and response details appear here."
          />
        ))}
      </Table>
    </div>
  );
}

export default { component: TableDemo, props: { head: "Result", children: "200 · 124 ms" } } satisfies Fixture;

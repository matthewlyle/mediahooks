import { useState } from "react";
import { Table, TableRow, type TableProps } from "../../public/ui/Table.tsx";
import "../../public/pages/EventsPage.css";
import type { Fixture } from "../fixture.ts";

function TableDemo({ children, head, ...props }: TableProps) {
  const [openRow, setOpenRow] = useState<number | null>(null);
  return (
    <Table
      {...props}
      className={["ev-list", props.className].filter(Boolean).join(" ")}
      headClassName={["ev-cols", props.headClassName].filter(Boolean).join(" ")}
      head={String(head ?? "")
        .split(",")
        .map((h) => (
          <span key={h}>{h.trim()}</span>
        ))}
    >
      {[0, 1, 2].map((i) => (
        <TableRow
          key={i}
          className="ev-row"
          summaryClassName="ev-summary"
          detailClassName="ev-detail"
          open={openRow === i}
          onToggle={() => setOpenRow(openRow === i ? null : i)}
          detailId={`demo-table-${i}`}
          summary={
            <>
              <span className="ev-time">{i + 1}m ago</span>
              <code className="ev-event">media.play</code>
              <span className="ev-user">alex</span>
              <span className="ev-title">
                <span className="ev-title-text">{`${children ?? ""} ${i + 1}`}</span>
              </span>
              <span className="ev-library">Movies</span>
              <span className="ev-sent">Discord</span>
            </>
          }
          detail={<p>Request and response details appear here.</p>}
        />
      ))}
    </Table>
  );
}

export default { component: TableDemo, props: { head: "Time, Event, User, Title, Library, Sent to", children: "Arrival" } } satisfies Fixture;

import { ClickableCard, type ClickableCardProps } from "../../public/ui/ClickableCard.tsx";
import type { Fixture } from "../fixture.ts";

function ClickableCardDemo({ children, ...props }: ClickableCardProps) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      <ClickableCard
        {...props}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "10px 14px",
        }}
      >
        <div>
          <div>{children}</div>
          <small>
            Opens {props.to} as “{props.label}”
          </small>
        </div>
      </ClickableCard>
    </ul>
  );
}

export default {
  component: ClickableCardDemo,
  props: {
    to: "/",
    label: "Living room alerts",
    children: "Living room alerts",
    actions: "Pause",
  },
} satisfies Fixture;

import { Button } from "../../public/ui/Button.tsx";
import { Switch } from "../../public/ui/Switch.tsx";
import { Toolbar } from "../../public/ui/Toolbar.tsx";
import type { Fixture } from "../fixture.ts";

export default {
  component: Toolbar,
  props: {
    gap: "small",
    end: false,
    children: (
      <>
        <Switch checked onChange={() => {}} label="Enabled" />
        <Button>Edit</Button>
        <Button variant="danger">Delete</Button>
      </>
    ),
  },
} satisfies Fixture;

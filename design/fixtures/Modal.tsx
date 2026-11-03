import { Fragment, createElement, useState } from "react";
import { Modal, type ModalProps } from "../../public/ui/Modal.tsx";
import type { Fixture } from "../fixture.ts";

function ModalDemo(props: ModalProps) {
  const [open, setOpen] = useState(true);
  return createElement(
    Fragment,
    null,
    createElement("button", { type: "button", onClick: () => setOpen(true) }, "Open modal"),
    open &&
      createElement(
        Modal,
        props,
        createElement("p", null, "Dialog content"),
        createElement("button", { type: "button", onClick: () => setOpen(false) }, "Close"),
      ),
  );
}

export default { component: ModalDemo, props: { label: "Example dialog" } } satisfies Fixture;

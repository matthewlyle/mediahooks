import { createElement, type ReactNode } from "react";
import { Button } from "../../public/ui/Button.tsx";
import { ToastProvider, useToast } from "../../public/ui/Toast.tsx";
import type { Fixture } from "../fixture.ts";

function ToastDemo({ children }: { children?: ReactNode }) {
  const toast = useToast();
  return createElement(Button, { onClick: () => toast.show(String(children ?? "")) }, "Show toast");
}

function ToastPreview({ children }: { children?: ReactNode }) {
  return createElement(ToastProvider, null, createElement(ToastDemo, null, children));
}

export default { component: ToastPreview, props: { children: "Saved" } } satisfies Fixture;

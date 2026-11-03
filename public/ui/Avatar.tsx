import { useState } from "react";
import { Menu, type MenuItem } from "./Menu.tsx";
import "./Avatar.css";

export type AvatarProps = {
  /** Accessible name of the trigger button and the menu. */
  label: string;
  /** Name shown above the menu items; its first letter fills the circle when there is no picture. */
  name: string;
  /** Picture URL. Falls back to the initial when missing or broken. */
  src?: string;
  /** Actions listed in the menu, in order. */
  items: MenuItem[];
};

/** A 28px round account button showing a picture or initial that opens a menu of actions. */
export function Avatar({ label, name, src, items }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  return (
    <Menu label={label} heading={name} triggerClassName="avatar" items={items}>
      {src && !broken ? (
        <img src={src} alt="" width={26} height={26} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </Menu>
  );
}

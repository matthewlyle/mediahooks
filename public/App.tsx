import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useLocation } from "wouter";
import type { AuthUser, Webhook } from "../src/types.ts";
import { LinkButton } from "./ui/Button.tsx";
import { Menu } from "./ui/Menu.tsx";
import { Modal } from "./ui/Modal.tsx";
import { ToastProvider } from "./ui/Toast.tsx";
import { api, setUnauthorizedHandler } from "./lib/api.ts";
import { EASE, SPRING, TAP, ids, routeDirection, useFinePointer } from "./lib/motion.ts";
import { PendingHeadingFocus, useLinkProps, useNav } from "./lib/nav.ts";
import { StoreProvider, useStore } from "./lib/store.tsx";
import { DetailPage } from "./pages/DetailPage.tsx";
import { EditorPage } from "./pages/EditorPage.tsx";
import { EventsPage } from "./pages/EventsPage.tsx";
import { HelpPage } from "./pages/HelpPage.tsx";
import { ListPage } from "./pages/ListPage.tsx";
import { SignInPage } from "./pages/SignInPage.tsx";

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </MotionConfig>
  );
}

type Section = "webhooks" | "events" | "help";

type Route = { key: string; section: Section; page: ReactElement; title: (webhooks: Webhook[]) => string };

function route(path: string): Route | null {
  if (path === "/") return { key: "list", section: "webhooks", page: <ListPage key="list" />, title: () => "Webhooks" };
  if (path === "/events") return { key: "events", section: "events", page: <EventsPage key="events" />, title: () => "Events" };
  if (path === "/help") return { key: "help", section: "help", page: <HelpPage key="help" />, title: () => "Help" };
  const edit = /^\/webhooks\/(\d+)\/edit$/.exec(path);
  if (edit) {
    const id = Number(edit[1]);
    return {
      key: `edit-${id}`,
      section: "webhooks",
      page: <EditorPage key={`edit-${id}`} id={id} />,
      title: (webhooks) => `Edit ${webhooks.find((w) => w.id === id)?.name ?? "webhook"}`,
    };
  }
  const detail = /^\/webhooks\/(\d+)$/.exec(path);
  if (detail) {
    const id = Number(detail[1]);
    return {
      key: `detail-${id}`,
      section: "webhooks",
      page: <DetailPage key={`detail-${id}`} id={id} />,
      title: (webhooks) => webhooks.find((w) => w.id === id)?.name ?? "Webhook",
    };
  }
  return null;
}

function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · mediahooks`;
  }, [title]);
  return null;
}

function RouteTitle({ title }: { title: Route["title"] }) {
  const { webhooks } = useStore();
  return <DocumentTitle title={title(webhooks)} />;
}

const SECTION_ORDER: Section[] = ["webhooks", "events", "help"];

type Auth = { status: "checking" } | { status: "signed-out" } | { status: "signed-in"; user: AuthUser | null };

const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: EASE.css } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE.css } },
} as const;

function Shell() {
  const [path] = useLocation();
  const navigate = useNav();
  const modal = path === "/new";
  // The page behind the New webhook modal: wherever it was opened from, else the list.
  const behind = useRef("/");
  if (!modal) behind.current = path;
  const current = route(behind.current);
  const missing = !current;
  const [auth, setAuth] = useState<Auth>({ status: "checking" });

  const last = useRef({ key: current?.key, section: current?.section ?? "webhooks", dir: 0 });
  const pendingHeadingFocus = useRef(false);
  if (current && current.key !== last.current.key) {
    const dir = Math.sign(SECTION_ORDER.indexOf(current.section) - SECTION_ORDER.indexOf(last.current.section));
    last.current = { key: current.key, section: current.section, dir };
    pendingHeadingFocus.current = true;
  }
  routeDirection.current = last.current.dir;

  const wasModal = useRef(modal);
  useEffect(() => {
    if (wasModal.current && !modal) requestAnimationFrame(() => document.getElementById("new-hook")?.focus());
    wasModal.current = modal;
  }, [modal]);

  useEffect(() => {
    if (missing) navigate("/", { replace: true, instant: true });
  }, [missing, navigate]);

  useEffect(() => {
    let live = true;
    setUnauthorizedHandler(() => setAuth({ status: "signed-out" }));
    void api<{ user: AuthUser | null }>("/api/auth/me").then((res) => {
      if (live) setAuth(res.ok ? { status: "signed-in", user: res.data.user } : { status: "signed-out" });
    });
    return () => {
      live = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  if (auth.status === "checking") return null;

  async function signOut() {
    await api("/api/auth/signout", { method: "POST" });
    setAuth({ status: "signed-out" });
  }

  return (
    <div className="shell">
      <Header
        path={path}
        section={current?.section ?? "webhooks"}
        signedIn={auth.status === "signed-in"}
        user={auth.status === "signed-in" ? auth.user : null}
        onSignOut={signOut}
        inert={modal}
      />
      <main>
        <AnimatePresence mode="wait">
          {auth.status === "signed-in" ? (
            <motion.div key="app" exit={FADE.exit}>
              <PendingHeadingFocus value={pendingHeadingFocus}>
                <StoreProvider>
                  {current && <RouteTitle title={modal ? () => "New webhook" : current.title} />}
                  <div className="routes" inert={modal || undefined}>
                    <AnimatePresence mode="popLayout" initial={false} custom={last.current.dir}>
                      {current?.page}
                    </AnimatePresence>
                  </div>
                  <AnimatePresence>
                    {modal && (
                      <Modal key="new" label="New webhook">
                        <EditorPage id={null} back={behind.current} />
                      </Modal>
                    )}
                  </AnimatePresence>
                </StoreProvider>
              </PendingHeadingFocus>
            </motion.div>
          ) : (
            <SignInPage key="sign-in" onSignedIn={(user) => setAuth({ status: "signed-in", user })} />
          )}
        </AnimatePresence>
      </main>
      {auth.status === "signed-out" && <DocumentTitle title="Sign in" />}
    </div>
  );
}

const NAV: { section: Section; to: string; label: string }[] = [
  { section: "webhooks", to: "/", label: "Webhooks" },
  { section: "events", to: "/events", label: "Events" },
  { section: "help", to: "/help", label: "Help" },
];

type HeaderProps = {
  path: string;
  section: Section;
  signedIn: boolean;
  user: AuthUser | null;
  onSignOut: () => void;
  inert: boolean;
};

function Header({ path, section, signedIn, user, onSignOut, inert }: HeaderProps) {
  return (
    <motion.header
      id="header"
      inert={inert || undefined}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE.outExpo }}
    >
      <div className="header-top">
        <h1>mediahooks</h1>
        <AnimatePresence initial={false}>
          {signedIn && (
            <motion.nav key="nav" className="nav" aria-label="Main" {...FADE}>
              {NAV.map((item) => (
                <NavLink key={item.to} {...item} active={item.section === section} />
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
      <div className="header-action">
        <AnimatePresence initial={false}>
          {signedIn && path !== "/new" && <NewWebhookButton key="new" />}
          {user && <AccountMenu key="account" user={user} onSignOut={onSignOut} />}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

function AccountMenu({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <motion.div className="account" {...FADE}>
      <Menu
        label={`Signed in as ${user.username}`}
        heading={user.username}
        triggerClassName="avatar-btn"
        items={[{ label: "Sign out", onSelect: onSignOut }]}
      >
        {user.thumb && !broken ? (
          <img src={user.thumb} alt="" width={26} height={26} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span>
        )}
      </Menu>
    </motion.div>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  const link = useLinkProps(to);
  const reduce = useReducedMotion();
  return (
    <motion.a
      {...link}
      className="nav-link"
      aria-current={active ? "page" : undefined}
      whileTap={reduce ? undefined : TAP}
      transition={SPRING.press}
    >
      {active && (
        <motion.span
          layoutId={ids.nav}
          className="nav-indicator"
          style={{ borderRadius: 2 }}
          transition={SPRING.morph}
          aria-hidden="true"
        />
      )}
      <span className="nav-label" data-label={label}>
        <span>{label}</span>
      </span>
    </motion.a>
  );
}

const ICON_IN = { type: "spring", visualDuration: 0.35, bounce: 0, opacity: { duration: 0.12, ease: EASE.outQuint } } as const;
const ICON_OUT = { type: "spring", visualDuration: 0.22, bounce: 0, opacity: { duration: 0.15, ease: EASE.outQuint } } as const;

function NewWebhookButton() {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const animated = fine && !reduce;
  const [icon, setIcon] = useState<{ on: boolean; by: "hover" | "focus" }>({ on: false, by: "hover" });

  const path = <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />;
  return (
    <LinkButton
      id="new-hook"
      to="/new"
      variant="primary"
      className="icon-reveal"
      style={{ borderRadius: 2 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE.css } }}
      transition={{ ...SPRING.press, opacity: { duration: 0.2, ease: EASE.css } }}
      onHoverStart={() => animated && setIcon({ on: true, by: "hover" })}
      onHoverEnd={(e) => !(e.target as Element).matches(":focus-visible") && setIcon({ on: false, by: "hover" })}
      onFocus={(e) => animated && e.currentTarget.matches(":focus-visible") && setIcon({ on: true, by: "focus" })}
      onBlur={(e) => !e.currentTarget.matches(":hover") && setIcon({ on: false, by: "focus" })}
    >
      {animated ? (
        <motion.svg
          className="icon-reveal-icon"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          initial={false}
          animate={icon.on ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
          transition={icon.by === "focus" ? { duration: 0 } : icon.on ? ICON_IN : ICON_OUT}
        >
          {path}
        </motion.svg>
      ) : (
        <svg className="icon-reveal-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          {path}
        </svg>
      )}
      New webhook
    </LinkButton>
  );
}

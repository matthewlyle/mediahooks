import "./reduced-motion.ts";
import "@fontsource-variable/space-grotesk";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "../public/ui/tokens.css";
import "../public/styles.css";
import "./stage.css";
import { createRoot } from "react-dom/client";
import { Stage } from "./Stage.tsx";

createRoot(document.getElementById("root")!).render(<Stage />);

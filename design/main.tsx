import "@fontsource-variable/space-grotesk";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "../public/styles.css";
import "./playground.css";
import { createRoot } from "react-dom/client";
import { Playground } from "./Playground.tsx";

createRoot(document.getElementById("root")!).render(<Playground />);

import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import PreviewApp from "./PreviewApp";
import { createDemoFetch } from "./demoTransport";
import "../index.css";

const params = new URLSearchParams(window.location.search);

// All API requests stay in this frame's memory. The CSP also blocks network connections.
window.fetch = createDemoFetch({ language: params.get("language") || "en" });
// Simulate online behavior so the real entry form never uses the account's offline queue.
Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root")).render(<PreviewApp client={client} />);

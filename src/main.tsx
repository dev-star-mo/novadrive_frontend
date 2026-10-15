import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { UserSessionProvider } from "@/components/providers/user-session-provider";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <UserSessionProvider>
        <App />
      </UserSessionProvider>
    </BrowserRouter>
  </StrictMode>,
);

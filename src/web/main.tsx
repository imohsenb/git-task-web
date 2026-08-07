import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./router";
import { IdentityDialogProvider } from "./components/identity/IdentityDialogContext";
import "./styles/tokens.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <IdentityDialogProvider>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors />
      </IdentityDialogProvider>
    </QueryClientProvider>
  </StrictMode>,
);

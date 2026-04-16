"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { cookieToInitialState, WagmiProvider, type State } from "wagmi";
import { useState, type ReactNode } from "react";
import {
  appMetadata,
  reownProjectId,
  statusHoodiNetwork,
  wagmiAdapter,
  wagmiConfig,
} from "@/lib/wallet/config";

createAppKit({
  adapters: [wagmiAdapter],
  networks: [statusHoodiNetwork],
  defaultNetwork: statusHoodiNetwork,
  projectId: reownProjectId,
  metadata: appMetadata,
  allowUnsupportedChain: false,
  themeMode: "dark",
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
  },
});

type AppKitProviderProps = {
  children: ReactNode;
  cookies: string | null;
};

export default function AppKitProvider({
  children,
  cookies,
}: AppKitProviderProps) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(wagmiConfig, cookies) as
    | State
    | undefined;

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

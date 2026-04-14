"use client";

import "@rainbow-me/rainbowkit/styles.css";

import {
  ConnectButton,
  getDefaultConfig,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { WagmiProvider } from "wagmi";
import { defineChain } from "viem";

const statusNetworkHoodi = defineChain({
  id: 374,
  name: "Status Network Hoodi",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://public.hoodi.rpc.status.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Status Hoodi Scan",
      url: "https://hoodiscan.status.network",
    },
  },
  testnet: true,
});

const config = getDefaultConfig({
  appName: "Matjip",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID",
  chains: [statusNetworkHoodi],
  ssr: true,
});

export default function WalletClient() {
  const [queryClient] = useState(() => new QueryClient());
  const theme = useMemo(
    () =>
      lightTheme({
        accentColor: "#111111",
        accentColorForeground: "#ffffff",
        borderRadius: "small",
      }),
    [],
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact" theme={theme}>
          <ConnectButton
            label="Connect wallet"
            accountStatus={{
              smallScreen: "avatar",
              largeScreen: "full",
            }}
            chainStatus={{
              smallScreen: "icon",
              largeScreen: "name",
            }}
            showBalance={false}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

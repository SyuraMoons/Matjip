import type { AppKitNetwork } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export const STATUS_HOODI_CHAIN_ID = 374;

export const reownProjectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
  "65b7cb63d6c2112382eeab47c2af4ef3";

const statusRpcUrl =
  process.env.NEXT_PUBLIC_STATUS_RPC_URL ||
  "https://public.hoodi.rpc.status.network/";

export const statusHoodiNetwork = {
  id: STATUS_HOODI_CHAIN_ID,
  caipNetworkId: `eip155:${STATUS_HOODI_CHAIN_ID}`,
  chainNamespace: "eip155",
  name: "Status Network Hoodi",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [statusRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "HoodiScan",
      url:
        process.env.NEXT_PUBLIC_STATUS_EXPLORER_URL ||
        "https://hoodiscan.status.network",
    },
  },
} as const satisfies AppKitNetwork;

export const wagmiAdapter = new WagmiAdapter({
  networks: [statusHoodiNetwork],
  projectId: reownProjectId,
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const appMetadata = {
  name: "Matjip",
  description: "Privacy-first memory map on Status Network Hoodi",
  url:
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000"),
  icons: [],
};

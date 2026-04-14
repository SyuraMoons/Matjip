"use client";

import dynamic from "next/dynamic";

const WalletClient = dynamic(() => import("./wallet-client"), {
  ssr: false,
  loading: () => (
    <div className="h-10 w-36 rounded-md border border-black/10 bg-zinc-100" />
  ),
});

export default function WalletClientLoader() {
  return <WalletClient />;
}

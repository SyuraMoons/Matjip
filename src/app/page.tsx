"use client";

import { useEffect, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useDisconnect } from "@reown/appkit-controllers/react";
import MapWrapper from "@/components/MapWrapper";
import WalletStatus from "@/components/WalletStatus";
import SignInPage from "@/components/SignInPage";
import type { KarmaRewardProgress } from "@/lib/karmaProgress";

function TileButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#c9b487] bg-[#faf1d8] shadow-[0_3px_0_#b89f6a,0_6px_10px_rgba(60,40,20,0.25)] transition-transform hover:-translate-y-0.5 hover:bg-[#fff5dd] active:translate-y-0 active:shadow-[0_1px_0_#b89f6a,0_2px_4px_rgba(60,40,20,0.25)]"
    >
      {children}
      <span
        className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border-2 border-[#c9b487] bg-[#faf1d8] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#4a2c15] opacity-0 shadow-[0_2px_0_#b89f6a,0_3px_6px_rgba(60,40,20,0.2)] transition-opacity duration-150 group-hover:opacity-100"
      >
        {label}
      </span>
    </button>
  );
}

function InitialLoader() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#efe3c3]">
      <div
        style={{
          fontFamily: "'Architects Daughter', 'Marker Felt', cursive",
          fontSize: "20px",
          fontWeight: 400,
          letterSpacing: "0.25em",
          color: "#2a1a0a",
          textTransform: "uppercase",
          display: "flex",
        }}
      >
        {"LOADING".split("").map((ch, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              animation: `letterWave 0.9s ease-in-out ${i * 0.14}s infinite`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [karmaRefreshNonce, setKarmaRefreshNonce] = useState(0);
  const [karmaRewardProgress, setKarmaRewardProgress] =
    useState<KarmaRewardProgress>({
      count: 0,
      target: 5,
    });
  const { isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { disconnect } = useDisconnect();

  useEffect(() => {
    const t = setTimeout(() => setIsInitializing(false), 700);
    return () => clearTimeout(t);
  }, []);

  if (isInitializing) {
    return <InitialLoader />;
  }

  if (!isConnected) {
    return <SignInPage />;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#efe3c3]">
      {/* Full-screen map */}
      <MapWrapper
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        onMemoryConfirmed={() => setKarmaRefreshNonce((nonce) => nonce + 1)}
        onRewardProgressChange={setKarmaRewardProgress}
      />

      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-start justify-between gap-4 px-6 py-4 pointer-events-none">
        <div>
          <h1 className="text-black text-xl font-bold tracking-tight">
            맛집
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          <WalletStatus
            refreshNonce={karmaRefreshNonce}
            rewardProgress={karmaRewardProgress}
          />
          <div className="flex flex-col items-end gap-2">
            <TileButton
              onClick={() => setIsModalOpen(true)}
              label="Add memory"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="#4a2c15"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 5h14a2 2 0 0 1 2 2v20l-9-4-9 4V7a2 2 0 0 1 2-2z" fill="#e8c674" />
                <line x1="14" y1="11" x2="14" y2="19" />
                <line x1="10" y1="15" x2="18" y2="15" />
              </svg>
            </TileButton>
            <TileButton onClick={() => disconnect()} label="Sign out">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="#4a2c15"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 6H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5" fill="#e8c674" />
                <polyline points="20,11 25,16 20,21" />
                <line x1="25" y1="16" x2="13" y2="16" />
              </svg>
            </TileButton>
          </div>
        </div>
      </div>

    </div>
  );
}

"use client";

import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { STATUS_HOODI_CHAIN_ID, statusHoodiNetwork } from "@/lib/wallet/config";

type KarmaInfo = {
  address: string;
  karmaBalance: string;
  tierId: number;
  tierName: string;
  txPerEpoch: number;
  gaslessEligible: boolean;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatKarmaBalance(balance: string) {
  const formatted = formatUnits(BigInt(balance), 18);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, "");

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export default function WalletStatus() {
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const [karmaInfo, setKarmaInfo] = useState<KarmaInfo | null>(null);
  const [karmaError, setKarmaError] = useState("");
  const [isLoadingKarma, setIsLoadingKarma] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const isOnStatusHoodi = Number(chainId) === STATUS_HOODI_CHAIN_ID;
  const addressLabel = useMemo(
    () => (address ? shortAddress(address) : ""),
    [address]
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadKarma() {
      if (!address || !isConnected) {
        setKarmaInfo(null);
        setKarmaError("");
        return;
      }

      setIsLoadingKarma(true);
      setKarmaError("");

      try {
        const response = await fetch(`/api/karma/${address}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to read Karma tier");
        }

        if (!isCancelled) {
          setKarmaInfo(payload as KarmaInfo);
        }
      } catch (error) {
        if (!isCancelled) {
          setKarmaInfo(null);
          setKarmaError(
            error instanceof Error ? error.message : "Unable to read Karma tier"
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingKarma(false);
        }
      }
    }

    loadKarma();

    return () => {
      isCancelled = true;
    };
  }, [address, isConnected]);

  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    try {
      await switchNetwork(statusHoodiNetwork);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2 text-right">
      {isConnected && (
        <div className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-gray-950/85 px-3 py-1.5 text-xs text-gray-200 shadow-lg shadow-purple-950/30">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-[11px] font-bold uppercase text-white">
            {addressLabel.charAt(2) || "?"}
          </div>
          <div className="font-medium text-white leading-tight">
            {addressLabel}
          </div>
        </div>
      )}

      {isConnected && (
        <div className="max-w-[260px] rounded-lg border border-purple-500/30 bg-gray-950/85 px-3 py-2 text-xs text-gray-200 shadow-lg shadow-purple-950/30">
          <div
            className={
              isOnStatusHoodi ? "text-emerald-300" : "text-amber-300"
            }
          >
            {isOnStatusHoodi
              ? "Status Hoodi connected"
              : `Wrong network${chainId ? ` (${chainId})` : ""}`}
          </div>

          {!isOnStatusHoodi && (
            <button
              type="button"
              onClick={handleSwitchNetwork}
              disabled={isSwitching}
              className="mt-2 rounded-md bg-purple-600 px-3 py-1 text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {isSwitching ? "Switching..." : "Switch to Hoodi"}
            </button>
          )}

          {isOnStatusHoodi && (
            <div className="mt-2 border-t border-purple-500/20 pt-2 text-gray-300">
              {isLoadingKarma && <div>Karma loading...</div>}
              {karmaError && (
                <div className="text-amber-300">
                  Karma unavailable: {karmaError}
                </div>
              )}
              {karmaInfo && (
                <>
                  <div>Total Karma: {formatKarmaBalance(karmaInfo.karmaBalance)}</div>
                  <div>Tier: {karmaInfo.tierName || "Unknown"}</div>
                  <div>Quota: {karmaInfo.txPerEpoch} tx / epoch</div>
                  <div
                    className={
                      karmaInfo.gaslessEligible
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }
                  >
                    {karmaInfo.gaslessEligible
                      ? "Gasless eligible"
                      : "No Karma yet"}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

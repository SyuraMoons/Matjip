"use client";

import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import type { KarmaRewardProgress } from "@/lib/karmaProgress";
import { STATUS_HOODI_CHAIN_ID, statusHoodiNetwork } from "@/lib/wallet/config";

type KarmaInfo = {
  address: string;
  karmaBalance: string;
  tierId: number;
  tierName: string;
  txPerEpoch: number;
  gaslessEligible: boolean;
  source: "official" | "matjip";
};

type WalletStatusProps = {
  refreshNonce?: number;
  rewardProgress?: KarmaRewardProgress;
};

const MATJIP_REWARD_AMOUNT = BigInt(3) * BigInt(10) ** BigInt(18);

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatKarmaBalance(balance: string) {
  const formatted = formatUnits(BigInt(balance), 18);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, "");

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export default function WalletStatus({
  refreshNonce = 0,
  rewardProgress = { count: 0, target: 5 },
}: WalletStatusProps) {
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const [karmaInfo, setKarmaInfo] = useState<KarmaInfo | null>(null);
  const [karmaError, setKarmaError] = useState("");
  const [isLoadingKarma, setIsLoadingKarma] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");
  const previousKarmaBalanceRef = useRef<bigint | null>(null);

  const isOnStatusHoodi = Number(chainId) === STATUS_HOODI_CHAIN_ID;
  const addressLabel = useMemo(
    () => (address ? shortAddress(address) : ""),
    [address]
  );

  useEffect(() => {
    previousKarmaBalanceRef.current = null;
    setRewardMessage("");
  }, [address]);

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

        const nextKarmaInfo = payload as KarmaInfo;
        const nextBalance = BigInt(nextKarmaInfo.karmaBalance);
        const previousBalance = previousKarmaBalanceRef.current;

        if (!isCancelled) {
          if (
            nextKarmaInfo.source === "matjip" &&
            previousBalance !== null &&
            nextBalance - previousBalance >= MATJIP_REWARD_AMOUNT
          ) {
            setRewardMessage("+3 Matjip Karma awarded");
          } else if (refreshNonce > 0 && nextKarmaInfo.source === "matjip") {
            setRewardMessage("Memory saved. Connected progress updated.");
          }

          previousKarmaBalanceRef.current = nextBalance;
          setKarmaInfo(nextKarmaInfo);
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
  }, [address, isConnected, refreshNonce]);

  useEffect(() => {
    if (!rewardMessage) return;

    const timeout = setTimeout(() => setRewardMessage(""), 6000);
    return () => clearTimeout(timeout);
  }, [rewardMessage]);

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
        <div className="flex items-center gap-2 rounded-full border border-[#E88788]/30 bg-gray-950/85 px-3 py-1.5 text-xs text-gray-200 shadow-lg shadow-[#E88788]/20">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E88788] text-[11px] font-bold uppercase text-white">
            {addressLabel.charAt(2) || "?"}
          </div>
          <div className="font-medium text-white leading-tight">
            {addressLabel}
          </div>
        </div>
      )}

      {isConnected && (
        <div className="max-w-[260px] rounded-lg border border-[#E88788]/30 bg-gray-950/85 px-3 py-2 text-xs text-gray-200 shadow-lg shadow-[#E88788]/20">
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
              className="mt-2 rounded-md bg-[#E88788] px-3 py-1 text-white transition hover:bg-[#d47778] disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {isSwitching ? "Switching..." : "Switch to Hoodi"}
            </button>
          )}

          {isOnStatusHoodi && (
            <div className="mt-2 border-t border-[#E88788]/20 pt-2 text-gray-300">
              {isLoadingKarma && <div>Refreshing Karma...</div>}
              {karmaError && (
                <div className="text-amber-300">
                  Karma unavailable: {karmaError}
                </div>
              )}
              {karmaInfo && (
                <>
                  <div className="font-semibold text-white">
                    {karmaInfo.source === "matjip" ? "Matjip Karma" : "Official Karma"}:{" "}
                    {formatKarmaBalance(karmaInfo.karmaBalance)}
                  </div>
                  <div>Tier: {karmaInfo.tierName || "Unknown"}</div>
                  <div>
                    {karmaInfo.source === "matjip" ? "Demo quota" : "Quota"}:{" "}
                    {karmaInfo.txPerEpoch} tx / epoch
                  </div>
                  <div
                    className={
                      karmaInfo.gaslessEligible
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }
                  >
                    {karmaInfo.gaslessEligible
                      ? karmaInfo.source === "matjip"
                        ? "Demo reward tier"
                        : "Gasless eligible"
                      : karmaInfo.source === "matjip"
                        ? "No Matjip Karma yet"
                        : "No official Karma yet"}
                  </div>
                  {karmaInfo.source === "matjip" && (
                    <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-left">
                      <div className="flex items-center justify-between text-[11px] text-emerald-200">
                        <span>Connected progress</span>
                        <span>
                          {rewardProgress.count}/{rewardProgress.target}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (rewardProgress.count / rewardProgress.target) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-gray-300">
                        Earn +3 when 5 nearby memories connect on the map.
                      </div>
                    </div>
                  )}
                  {rewardMessage && (
                    <div className="mt-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                      {rewardMessage}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] leading-snug text-gray-400">
                    {karmaInfo.source === "matjip"
                      ? "Demo soulbound Karma mirrors Status tiers; official Status Karma still controls real gasless eligibility."
                      : "Memory activity may update after Status processes network usage."}
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

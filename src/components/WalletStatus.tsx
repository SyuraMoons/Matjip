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

type KarmaSummary = {
  address: string;
  official?: KarmaInfo;
  matjip?: KarmaInfo;
  errors?: {
    official?: string;
    matjip?: string;
  };
};

type WalletStatusProps = {
  refreshNonce?: number;
  rewardProgress?: KarmaRewardProgress;
};

const MATJIP_REWARD_AMOUNT = BigInt(3) * BigInt(10) ** BigInt(18);
const EMPTY_REWARD_PROGRESS: KarmaRewardProgress = {
  count: 0,
  target: 5,
  regionCount: 0,
  bestRegionSize: 0,
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

export default function WalletStatus({
  refreshNonce = 0,
  rewardProgress = EMPTY_REWARD_PROGRESS,
}: WalletStatusProps) {
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const [karmaSummary, setKarmaSummary] = useState<KarmaSummary | null>(null);
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
        setKarmaSummary(null);
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

        const nextKarmaSummary = payload as KarmaSummary;
        const nextMatjipBalance = nextKarmaSummary.matjip
          ? BigInt(nextKarmaSummary.matjip.karmaBalance)
          : null;
        const previousBalance = previousKarmaBalanceRef.current;

        if (!isCancelled) {
          if (
            nextMatjipBalance !== null &&
            previousBalance !== null &&
            nextMatjipBalance - previousBalance >= MATJIP_REWARD_AMOUNT
          ) {
            setRewardMessage("+3 Matjip Karma awarded");
          } else if (refreshNonce > 0 && nextMatjipBalance !== null) {
            setRewardMessage("Memory saved. Connected progress updated.");
          }

          previousKarmaBalanceRef.current = nextMatjipBalance;
          setKarmaSummary(nextKarmaSummary);
        }
      } catch (error) {
        if (!isCancelled) {
          setKarmaSummary(null);
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
              {karmaSummary && (
                <>
                  <div className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-2 text-left">
                    <div className="font-semibold text-cyan-100">
                      Real Status Karma
                    </div>
                    {karmaSummary.official ? (
                      <>
                        <div>
                          Balance:{" "}
                          {formatKarmaBalance(
                            karmaSummary.official.karmaBalance
                          )}
                        </div>
                        <div>
                          Tier: {karmaSummary.official.tierName || "Unknown"}
                        </div>
                        <div>
                          Quota: {karmaSummary.official.txPerEpoch} tx / epoch
                        </div>
                        <div
                          className={
                            karmaSummary.official.gaslessEligible
                              ? "text-emerald-300"
                              : "text-amber-300"
                          }
                        >
                          {karmaSummary.official.gaslessEligible
                            ? "Real gasless eligible"
                            : "No real Karma yet"}
                        </div>
                      </>
                    ) : (
                      <div className="text-amber-300">
                        {karmaSummary.errors?.official ||
                          "Real Status Karma unavailable"}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] leading-snug text-gray-400">
                      Controls official Status Network gasless eligibility.
                    </div>
                  </div>

                  <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-left">
                    <div className="font-semibold text-emerald-100">
                      Demo Matjip Karma
                    </div>
                    {karmaSummary.matjip ? (
                      <>
                        <div>
                          Balance:{" "}
                          {formatKarmaBalance(karmaSummary.matjip.karmaBalance)}
                        </div>
                        <div>
                          Demo tier: {karmaSummary.matjip.tierName || "None"}
                        </div>
                        <div>
                          Demo quota: {karmaSummary.matjip.txPerEpoch} tx /
                          epoch
                        </div>
                      </>
                    ) : (
                      <div className="text-amber-300">
                        {karmaSummary.errors?.matjip ||
                          "Demo Matjip Karma unavailable"}
                      </div>
                    )}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] text-emerald-200">
                        <span>Best connected region</span>
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
                        Showing the closest region to a reward. Earn +3 when
                        any 5 nearby unclaimed memories connect.
                      </div>
                      {rewardProgress.regionCount > 1 && (
                        <div className="mt-1 text-[11px] leading-snug text-gray-400">
                          {rewardProgress.regionCount} regions in progress
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-gray-400">
                      App-level soulbound reward for this hackathon demo. Demo
                      Karma does not grant real gasless transactions.
                    </div>
                  </div>
                  {rewardMessage && (
                    <div className="mt-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                      {rewardMessage}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

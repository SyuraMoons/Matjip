export const STATUS_HOODI_CHAIN_ID = 374;
export const KARMA_ADDRESS =
  process.env.NEXT_PUBLIC_KARMA_ADDRESS ||
  "0x0700be6f329cc48c38144f71c898b72795db6c1b";
export const KARMA_TIERS_ADDRESS =
  process.env.NEXT_PUBLIC_KARMA_TIERS_ADDRESS ||
  "0xb8039632e089dcefa6bbb1590948926b2463b691";

const BALANCE_OF_SELECTOR = "0x70a08231";
const GET_TIER_ID_BY_KARMA_BALANCE_SELECTOR = "0xa04f7fc7";
const GET_TIER_BY_ID_SELECTOR = "0xc7a41671";

type JsonRpcResponse = {
  result?: string;
  error?: {
    code: number;
    message: string;
  };
};

export type KarmaTier = {
  minKarma: string;
  maxKarma: string;
  name: string;
  txPerEpoch: number;
};

export type KarmaInfo = {
  address: string;
  karmaBalance: string;
  tierId: number;
  tierName: string;
  txPerEpoch: number;
  gaslessEligible: boolean;
};

function rpcUrl() {
  const url =
    process.env.STATUS_HOODI_RPC_URL || process.env.NEXT_PUBLIC_STATUS_RPC_URL;

  if (!url) {
    throw new Error("STATUS_HOODI_RPC_URL is not configured");
  }

  return url;
}

export function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function encodeAddress(address: string) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function encodeUint256(value: bigint | number) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function hexToBigInt(hex: string, label = "hex value") {
  if (!hex || hex === "0x") {
    throw new Error(
      `Empty contract response for ${label}. Check RPC network and contract address.`
    );
  }

  return BigInt(hex);
}

function readWord(data: string, wordIndex: number) {
  const normalized = data.replace(/^0x/, "");
  const start = wordIndex * 64;
  const end = (wordIndex + 1) * 64;
  const word = normalized.slice(start, end);

  if (word.length !== 64) {
    throw new Error(
      "Invalid contract response length. Check RPC network and contract address."
    );
  }

  return `0x${word}`;
}

function decodeString(data: string, offsetBytes: bigint, baseOffsetBytes = 0) {
  const normalized = data.replace(/^0x/, "");
  const lengthStart = (baseOffsetBytes + Number(offsetBytes)) * 2;
  const lengthWord = normalized.slice(lengthStart, lengthStart + 64);

  if (lengthWord.length !== 64) {
    throw new Error(
      "Invalid string response length. Check KarmaTiers contract ABI."
    );
  }

  const length = Number(BigInt(`0x${lengthWord}`));
  const stringStart = lengthStart + 64;
  const stringHex = normalized.slice(stringStart, stringStart + length * 2);

  return Buffer.from(stringHex, "hex").toString("utf8");
}

function decodeTier(tierResult: string) {
  const structOffset = Number(hexToBigInt(readWord(tierResult, 0), "tier offset"));
  const structWordOffset = structOffset / 32;
  const nameOffset = hexToBigInt(
    readWord(tierResult, structWordOffset + 2),
    "tier name offset"
  );

  return {
    tierName: decodeString(tierResult, nameOffset, structOffset),
    txPerEpoch: Number(
      hexToBigInt(readWord(tierResult, structWordOffset + 3), "tier txPerEpoch")
    ),
  };
}

async function ethCall(to: string, data: string, label: string) {
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Status RPC request failed with ${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcResponse;

  if (payload.error) {
    throw new Error(payload.error.message);
  }

  if (!payload.result || payload.result === "0x") {
    throw new Error(
      `Empty contract response for ${label}. Check RPC network and contract address.`
    );
  }

  return payload.result;
}

export async function getKarmaInfo(address: string): Promise<KarmaInfo> {
  const normalizedAddress = address.toLowerCase();

  if (!isAddress(normalizedAddress)) {
    throw new Error("Invalid wallet address");
  }

  const balanceResult = await ethCall(
    KARMA_ADDRESS,
    `${BALANCE_OF_SELECTOR}${encodeAddress(normalizedAddress)}`,
    "Karma.balanceOf"
  );
  const karmaBalance = hexToBigInt(balanceResult, "Karma.balanceOf");

  const tierIdResult = await ethCall(
    KARMA_TIERS_ADDRESS,
    `${GET_TIER_ID_BY_KARMA_BALANCE_SELECTOR}${encodeUint256(karmaBalance)}`,
    "KarmaTiers.getTierIdByKarmaBalance"
  );
  const tierId = Number(
    hexToBigInt(tierIdResult, "KarmaTiers.getTierIdByKarmaBalance")
  );

  const tierResult = await ethCall(
    KARMA_TIERS_ADDRESS,
    `${GET_TIER_BY_ID_SELECTOR}${encodeUint256(tierId)}`,
    "KarmaTiers.getTierById"
  );
  const { tierName, txPerEpoch } = decodeTier(tierResult);

  return {
    address: normalizedAddress,
    karmaBalance: karmaBalance.toString(),
    tierId,
    tierName,
    txPerEpoch,
    gaslessEligible: karmaBalance > BigInt(0),
  };
}

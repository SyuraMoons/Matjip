import { encodeFunctionData, type Address, type Hex } from "viem";
import { statusHoodiNetwork } from "./config";
import { memoryRegistryAbi, MEMORY_REGISTRY_ADDRESS } from "./memoryRegistry";

type LineaEstimateGasResult = {
  gasLimit?: string | number | bigint;
  baseFeePerGas?: string | number | bigint;
  priorityFeePerGas?: string | number | bigint;
};

type CreateMemoryArgs = readonly [
  metadataCid: string,
  metadataHash: Hex,
  latE6: number,
  lngE6: number,
];

function toBigIntGas(value: string | number | bigint | undefined, label: string) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`linea_estimateGas did not return ${label}`);
  }

  return BigInt(value);
}

async function lineaEstimateGas(from: Address, to: Address, data: Hex) {
  const rpcUrl = statusHoodiNetwork.rpcUrls.default.http[0];
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "linea_estimateGas",
      params: [{ from, to, data }],
    }),
  });

  if (!response.ok) {
    throw new Error(`linea_estimateGas failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: LineaEstimateGasResult;
    error?: { message?: string };
  };

  if (payload.error) {
    throw new Error(payload.error.message || "linea_estimateGas failed");
  }

  if (!payload.result) {
    throw new Error("linea_estimateGas returned no result");
  }

  const gas = toBigIntGas(payload.result.gasLimit, "gasLimit");
  const baseFeePerGas = toBigIntGas(payload.result.baseFeePerGas, "baseFeePerGas");
  const maxPriorityFeePerGas = toBigIntGas(
    payload.result.priorityFeePerGas,
    "priorityFeePerGas"
  );

  return {
    gas,
    maxFeePerGas: baseFeePerGas + maxPriorityFeePerGas,
    maxPriorityFeePerGas,
  };
}

export async function estimateCreateMemoryGas(from: Address, args: CreateMemoryArgs) {
  const data = encodeFunctionData({
    abi: memoryRegistryAbi,
    functionName: "createMemory",
    args,
  });

  return lineaEstimateGas(from, MEMORY_REGISTRY_ADDRESS, data);
}

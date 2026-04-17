import { readContract } from "@wagmi/core";
import type { Address, Hex } from "viem";
import { ipfsToGatewayUrl } from "./ipfs";
import type { KarmaProgressMemory } from "./karmaProgress";
import type { MemoryMetadata } from "./memory";
import { wagmiConfig } from "./wallet/config";
import { memoryRegistryContract } from "./wallet/memoryRegistry";

export type DecentralizedMemory = {
  id: number;
  poster: Address;
  metadataCid: string;
  metadataHash: Hex;
  lat: number;
  lng: number;
  createdAt: number;
  metadata: MemoryMetadata;
};

type ContractMemory = {
  poster: Address;
  metadataCid: string;
  metadataHash: Hex;
  latE6: number;
  lngE6: number;
  createdAt: bigint;
};

async function fetchMemoryMetadata(metadataCid: string) {
  const response = await fetch(ipfsToGatewayUrl(metadataCid));

  if (!response.ok) {
    throw new Error(`Unable to fetch ${metadataCid}`);
  }

  return (await response.json()) as MemoryMetadata;
}

export async function loadDecentralizedMemories(options?: {
  poster?: Address;
}) {
  const memoryCount = await readContract(wagmiConfig, {
    ...memoryRegistryContract,
    functionName: "memoryCount",
  });
  const normalizedPoster = options?.poster?.toLowerCase();
  const ids = Array.from({ length: Number(memoryCount) }, (_, index) => index);

  const memories = await Promise.all(
    ids.map(async (id) => {
      const chainMemory = (await readContract(wagmiConfig, {
        ...memoryRegistryContract,
        functionName: "getMemory",
        args: [BigInt(id)],
      })) as ContractMemory;

      if (
        normalizedPoster &&
        chainMemory.poster.toLowerCase() !== normalizedPoster
      ) {
        return null;
      }

      let metadata: MemoryMetadata;
      try {
        metadata = await fetchMemoryMetadata(chainMemory.metadataCid);
      } catch (error) {
        console.warn(
          `Skipping memory ${id}; metadata is not available yet`,
          error
        );
        return null;
      }

      return {
        id,
        poster: chainMemory.poster,
        metadataCid: chainMemory.metadataCid,
        metadataHash: chainMemory.metadataHash,
        lat: Number(chainMemory.latE6) / 1_000_000,
        lng: Number(chainMemory.lngE6) / 1_000_000,
        createdAt: Number(chainMemory.createdAt),
        metadata,
      } satisfies DecentralizedMemory;
    })
  );

  return memories
    .filter((memory): memory is DecentralizedMemory => memory !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function loadKarmaProgressMemories(): Promise<
  KarmaProgressMemory[]
> {
  const memoryCount = await readContract(wagmiConfig, {
    ...memoryRegistryContract,
    functionName: "memoryCount",
  });
  const ids = Array.from({ length: Number(memoryCount) }, (_, index) => index);

  return Promise.all(
    ids.map(async (id) => {
      const [chainMemory, rewardClaimed] = await Promise.all([
        readContract(wagmiConfig, {
          ...memoryRegistryContract,
          functionName: "getMemory",
          args: [BigInt(id)],
        }) as Promise<ContractMemory>,
        readContract(wagmiConfig, {
          ...memoryRegistryContract,
          functionName: "isRewardClaimed",
          args: [BigInt(id)],
        }) as Promise<boolean>,
      ]);

      return {
        id,
        lat: Number(chainMemory.latE6) / 1_000_000,
        lng: Number(chainMemory.lngE6) / 1_000_000,
        rewardClaimed,
      };
    })
  );
}

export function decentralizedMemoryToMapMemory(memory: DecentralizedMemory) {
  const createdDate = memory.createdAt
    ? new Date(memory.createdAt * 1000)
    : new Date(memory.metadata.createdAt);

  return {
    id: memory.id,
    title: memory.metadata.title,
    caption: memory.metadata.description,
    date: createdDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    location: memory.metadata.locationName || "Unknown Location",
    lat: memory.lat,
    lng: memory.lng,
    photos: memory.metadata.images.map(ipfsToGatewayUrl),
    emoji: "📍",
    metadataCid: memory.metadataCid,
    metadataHash: memory.metadataHash,
  };
}

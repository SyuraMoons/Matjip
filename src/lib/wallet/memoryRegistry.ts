import type { Address } from "viem";
import { STATUS_HOODI_CHAIN_ID } from "./config";

export const MEMORY_REGISTRY_ADDRESS = (
  process.env.NEXT_PUBLIC_MEMORY_REGISTRY_ADDRESS ||
  "0x3b9a588c763314233ba804d3a19067233a97349c"
) as Address;

export const memoryRegistryAbi = [
  {
    type: "function",
    name: "createMemory",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadataCid", type: "string" },
      { name: "metadataHash", type: "bytes32" },
      { name: "latE6", type: "int32" },
      { name: "lngE6", type: "int32" },
    ],
    outputs: [{ name: "memoryId", type: "uint256" }],
  },
  {
    type: "function",
    name: "memoryCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getMemory",
    stateMutability: "view",
    inputs: [{ name: "memoryId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "poster", type: "address" },
          { name: "metadataCid", type: "string" },
          { name: "metadataHash", type: "bytes32" },
          { name: "latE6", type: "int32" },
          { name: "lngE6", type: "int32" },
          { name: "createdAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "MemoryCreated",
    inputs: [
      { name: "memoryId", type: "uint256", indexed: true },
      { name: "poster", type: "address", indexed: true },
      { name: "metadataCid", type: "string", indexed: false },
      { name: "metadataHash", type: "bytes32", indexed: false },
      { name: "latE6", type: "int32", indexed: false },
      { name: "lngE6", type: "int32", indexed: false },
      { name: "createdAt", type: "uint64", indexed: false },
    ],
  },
] as const;

export const memoryRegistryContract = {
  address: MEMORY_REGISTRY_ADDRESS,
  abi: memoryRegistryAbi,
  chainId: STATUS_HOODI_CHAIN_ID,
} as const;

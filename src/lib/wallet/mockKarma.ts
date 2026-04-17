import type { Address } from "viem";
import { STATUS_HOODI_CHAIN_ID } from "./config";

export const MOCK_KARMA_ADDRESS = process.env
  .NEXT_PUBLIC_MOCK_KARMA_ADDRESS as Address | undefined;

export const mockKarmaAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "pure",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "pure",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "pure",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const mockKarmaContract = MOCK_KARMA_ADDRESS
  ? ({
      address: MOCK_KARMA_ADDRESS,
      abi: mockKarmaAbi,
      chainId: STATUS_HOODI_CHAIN_ID,
    } as const)
  : null;

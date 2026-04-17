# Matjip Hackathon Submission

## Project Basics

Project name: Matjip

Tagline: A privacy-first onchain memory map where places are revealed through shared memories and Karma-aware participation.

Live demo: https://matjip-seven.vercel.app/

GitHub: https://github.com/SyuraMoons/Matjip

Network: Status Network Hoodi Testnet

Chain ID: `374`

RPC: `https://public.hoodi.rpc.status.network/`

Explorer: https://hoodiscan.status.network

## Short Description

Matjip is a map-based memory app built on Status Network Hoodi. Users connect a wallet, add photo memories to real locations, upload media and metadata to IPFS, and anchor each memory onchain through a deployed `MemoryRegistry` contract.

As more memories connect nearby, the map reveals larger areas. When 5 nearby memories connect into a larger revealed area, the triggering wallet earns `+3` demo Matjip Karma.

The app also reads the connected wallet's real Status Karma and displays the official Karma balance, tier, quota, and real gasless eligibility. Because third-party app Karma minting is not currently available, Matjip uses a mock soulbound Karma token to demonstrate how app-level reputation rewards could work in the Status ecosystem.

## Problem

Most social and memory apps rely on centralized accounts, platform-controlled data, and persistent user identities. Onchain apps can improve ownership and transparency, but gas fees and wallet funding make casual participation feel heavy.

For a memory map, the ideal flow should feel lightweight: visit a place, add a memory, reveal more of the map, and build reputation naturally. Status Network's gasless and Karma design makes this kind of app more realistic because users can participate without constantly thinking about gas or exposing unnecessary wallet-funding patterns.

## Solution

Matjip turns memory creation into an onchain, Karma-aware map experience:

- Users add memories with photos, captions, dates, and locations.
- Images and metadata are uploaded to IPFS through Pinata.
- A small public anchor is stored onchain in `MemoryRegistry`.
- The map reveals areas around saved memories.
- Connected memories create visible routes and larger revealed zones.
- When 5 nearby unclaimed memories connect, `MemoryRegistry` mints `+3` demo Matjip Karma to the wallet that created the triggering memory.
- The wallet panel clearly shows both real Status Karma and demo Matjip Karma.

This creates a simple reputation loop: users contribute meaningful location memories, the shared map becomes more visible, and contributors earn app-level reputation.

## Why Status Network

Matjip fits Status Network because the app is strongest when onchain participation feels lightweight and reputation-aware.

Without gasless execution, adding a memory becomes a transaction-cost decision. With Status Network's gasless model, the product can feel closer to a normal social action while still anchoring the memory onchain.

Status Karma is also a strong fit because Matjip is based on contribution quality and participation. The app can use Karma to show who has earned reputation and, in future versions, unlock higher contribution throughput or map features without relying on transferable tokens or KYC.

## Status Network Integration

### Real Status Karma

Matjip reads the connected wallet's real Status Karma onchain and displays:

- Real Status Karma balance
- Karma tier
- Transaction quota
- Real gasless eligibility

This uses the official Status Karma contracts and gives users a clear view of their actual Status Network reputation status.

### Demo Matjip Karma

Because app developers cannot currently mint official Status Karma directly, Matjip deploys a mock soulbound Karma token called `MockKarma`.

The demo reward logic mirrors the Status Karma concept:

- `MockKarma` is soulbound and cannot be transferred.
- Only `MemoryRegistry` can mint it.
- When 5 connected nearby memories form a larger revealed map area, the triggering wallet receives `+3` Matjip Karma.
- The UI clearly labels this as demo Karma.
- Demo Matjip Karma does not grant real Status Network gasless transactions.

### Gasless-Ready Flow

Matjip integrates the intended Status gasless flow using `linea_estimateGas`.

During the hackathon, Hoodi had a known RLN prover registration issue where fully gasless transactions could fail with:

```text
RLN prover rejected transaction (NOT_FOUND): Sender not registered
```

Following Status builder guidance, Matjip still calls `linea_estimateGas` and passes the returned gas values into the transaction, but uses paid gas as the temporary fallback while the network-side issue is being fixed.

This means the app is structurally ready for the real gasless path once the Hoodi RLN sender registration bug is resolved.

## App Flow

1. User opens Matjip and connects a wallet.
2. User switches to Status Network Hoodi.
3. The wallet panel displays real Status Karma and demo Matjip Karma.
4. User clicks `Add memory`.
5. User adds a photo, title, caption, date, and location.
6. The app uploads image files and metadata to IPFS through Pinata.
7. The app prepares the transaction with `linea_estimateGas`.
8. The wallet calls `MemoryRegistry.createMemory(...)`.
9. The map reloads onchain memories and reveals the new memory area.
10. If the new memory completes a connected group of 5 nearby memories, the contract mints `+3` demo Matjip Karma.

## Onchain Design

`MemoryRegistry` stores only a small public anchor for each memory:

- Poster address
- IPFS metadata CID
- Metadata hash
- Rounded latitude and longitude in E6 format
- Block timestamp

Photos, title, description, and location text stay offchain in IPFS metadata.

The main contract function is:

```solidity
function createMemory(
    string calldata metadataCid,
    bytes32 metadataHash,
    int32 latE6,
    int32 lngE6
) external returns (uint256 memoryId);
```

The contract emits:

```solidity
event MemoryCreated(
    uint256 indexed memoryId,
    address indexed poster,
    string metadataCid,
    bytes32 metadataHash,
    int32 latE6,
    int32 lngE6,
    uint64 createdAt
);
```

The demo Karma reward is emitted when a connected memory group earns Karma:

```solidity
event KarmaRewarded(
    address indexed poster,
    uint256 amount,
    uint256 triggeringMemoryId,
    uint256 componentSize
);
```

## Deployed Contracts

Network: Status Network Hoodi Testnet

| Contract | Address |
| --- | --- |
| MockKarma | `0x39eee569c1f2c28f86e79d38b3ed350488bac908` |
| MemoryRegistry | `0x33e8142b8951d3ebaf078a4245e8f107cc8024da` |

## Deployment Transactions

| Action | Transaction |
| --- | --- |
| Deploy MockKarma | `0x0390d50a200838f8d83bee5c13d06a24284196ba6455f8ab44519743218e48a6` |
| Deploy MemoryRegistry | `0xb0943f6f4c31b85df5a29df4bdfdc202b3e82a0a7fbdb5002b0a8ab212efc0db` |
| Set MockKarma minter | `0x85f093614c5bdfd69607cd29103bca12022f854ad436fee447e8aa1a6d419126` |

Explorer: https://hoodiscan.status.network

## Core App Transactions

These transactions demonstrate the core app flow on Status Network Hoodi. Each save was prepared through the Status-supported `linea_estimateGas` flow before wallet confirmation.

| Action | Transaction |
| --- | --- |
| `createMemory` | `0xef2c97777c33fc0ae6f3f7461ff3926304670bc750e766115840e681870d6072` |
| `createMemory` | `0x114be415907c475806ec9bcdd9c4e3fe05eb0014e1cb34d787e3707a6ddffc94` |
| `createMemory` | `0x724aa305f3dd8ac828d8119875e841a5d3d63afa2350281ab08d8d793a4499cc` |
| `createMemory` | `0xdb0bc23d6a0b82fb33ece1a8aef9698c59dc5a36b2fbcb222ea20dc2e0d82b74` |
| `createMemory` and `KarmaRewarded` | `0x02c0a6ff3c851c2fd27eb733faf00ba40b42d016f5ffefb4d18d67c598cf4859` |

Additional live saves:

```text
0x635d6b1a100d121ed68f0af3169f7c7747343ff2e0ca03f95b2a5cc326c970a9
0x71d4dd3a5dad23aa1d9e6d788766b1574b4584df2ded3ae6baa5939068da1d31
```

## Builder Quest Checklist

| Requirement | Status |
| --- | --- |
| Deploy at least one smart contract on Status Network Hoodi Testnet | Completed |
| Execute 5+ transactions demonstrating core app functionality | Completed |
| Read the user's Karma tier onchain and display or use it | Completed |
| Submit a 2-minute demo video | To be added after recording |
| Open-source the code on GitHub with a README | Completed |
| Share a live functional app demo | Completed |

## Evaluation Criteria Mapping

### Privacy / Agentic Design

Matjip uses Status Network's gasless-ready model to support lightweight onchain interaction without requiring users to pre-fund wallets just to add memories. This improves privacy because wallet funding patterns do not need to become part of the user journey.

The app also fits Status Network's RLN direction because participation can be rate-limited through Karma rather than identity-heavy accounts or KYC.

### Karma Integration

Matjip does more than display Karma. It separates real Status Karma from demo app Karma:

- Real Status Karma is read from the official contracts and displayed in the wallet panel.
- Real Status Karma controls official gasless eligibility.
- Demo Matjip Karma models how app-specific contribution rewards could work.
- Demo rewards are tied to meaningful behavior: connecting 5 memories to reveal a larger map area.

### Gasless UX

The ideal Matjip experience depends on gasless interaction. Adding a memory should feel like posting a memory, not managing transaction costs.

The app integrates `linea_estimateGas` so the flow is ready for Status gasless execution, while using the recommended paid fallback during the Hoodi RLN issue.

### Functionality

The app is live and testable. Judges can connect a wallet, switch to Hoodi, add a memory, upload to IPFS, submit the onchain transaction, view memories on the map, and see Karma status in the wallet panel.

### Fun & Appeal

Matjip turns maps into a shared memory discovery experience. Places become more visible as users contribute memories, and connected memories create a simple reward loop through demo Karma.

## Technical Stack

- Next.js app frontend
- Status Network Hoodi Testnet
- Reown AppKit wallet connection
- Wagmi and Viem for contract reads/writes
- Foundry for Solidity contracts and deployment
- Pinata and IPFS for image and metadata storage
- Leaflet for interactive map rendering
- Vercel for live deployment

## Demo Video Script

### 0:00-0:15 - Intro

Hi, this is Matjip, a privacy-first memory map built on Status Network Hoodi. The idea is simple: users add memories to real places, reveal more of the map, and build Karma-aware reputation through contribution.

### 0:15-0:35 - Connect Wallet and Karma

Here I connect my wallet on Status Network Hoodi. The wallet panel shows two Karma sections. The first is real Status Karma, read from the official Status contracts. The second is demo Matjip Karma, our app-level soulbound reward token.

### 0:35-1:05 - Add Memory

Now I add a memory. I choose a photo, write the memory details, select a location, and submit. The image and metadata are uploaded to IPFS, while the contract stores only the onchain anchor: poster, metadata CID, metadata hash, coordinates, and timestamp.

### 1:05-1:25 - Gasless-Ready Flow

Matjip integrates the Status gasless path through `linea_estimateGas`. Because Hoodi currently has the known RLN prover registration bug, the app uses the Status-recommended paid fallback, but the structure is already ready for the gasless path when the network fix lands.

### 1:25-1:45 - Map Reveal and Demo Karma

When memories are nearby, the map reveals connected areas. Once 5 connected memories form a larger revealed area, the contract mints `+3` demo Matjip Karma to the wallet that triggered the connection.

### 1:45-2:00 - Closing

Matjip shows how Status Network can make onchain social apps feel lightweight, private, and reputation-aware. Real Status Karma controls official gasless eligibility, while demo Matjip Karma demonstrates an app-specific reputation mechanic for meaningful contributions.

## Links To Submit

Live app:

```text
https://matjip-seven.vercel.app/
```

GitHub:

```text
https://github.com/SyuraMoons/Matjip
```

Hoodi explorer:

```text
https://hoodiscan.status.network
```

MockKarma:

```text
0x39eee569c1f2c28f86e79d38b3ed350488bac908
```

MemoryRegistry:

```text
0x33e8142b8951d3ebaf078a4245e8f107cc8024da
```

Demo video:

```text
Add video URL after recording.
```

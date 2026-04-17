# Matjip

Matjip is a privacy-first spatial memory diary built on Status Network Hoodi.
It helps people who document their lives remember experiences with context, not
just store photos in a camera roll or post them into a feed.

People already capture everything: photos, captions, journals, voice notes, and
stories. But those memories become scattered across camera rolls and social
platforms. Feeds are built for sharing and engagement, not long-term recall.
Over time, the details that made a place meaningful become hard to reconstruct.

Matjip makes memory spatial. Users add photo memories to real locations, store
media and metadata on IPFS, and anchor each memory on-chain through
`MemoryRegistry`. Instead of a flat feed, users see a living map of where their
memories happened.

Every memory reveals part of the map. When 5 nearby memories connect, they
create a larger revealed area and the triggering wallet earns +3 demo Matjip
Karma. This turns reflection into a lightweight progression loop: earn by
remembering, explore by adding depth, and grow the map over time.

## Problem

People who document their lives need a way to recall their experiences without
forgetting the depth that made them meaningful.

Camera rolls and social feeds flatten memories into timelines. They preserve
files, but they do not preserve the feeling of where something happened, what
surrounded it, or how moments connected over time. Matjip uses place as the
organizing layer because experiences are easier to revisit when they are tied to
locations.

## Solution

Matjip is a geolocation-based memory diary:

- memories are attached to real places, not only timestamps
- photos and metadata are stored on IPFS through Pinata
- the contract stores a small public anchor for each memory
- the map reveals areas around saved memories instead of showing a flat feed
- connected memories reward repeated reflection and deeper exploration
- real Status Karma is displayed, while demo Matjip Karma models app-level
  contribution reputation

The result is a user-owned archive that feels more like a private life map than
a public social feed.

## Live Demo

https://matjip-seven.vercel.app/

## Status Network Integration

Matjip is designed around the Status Network stack:

- **Real Status Karma:** the app reads the connected wallet's real Status Karma
  from official Status contracts and displays balance, tier, quota, and gasless
  eligibility.
- **Demo Matjip Karma:** the app deploys a mock soulbound Karma token to show how
  app-specific reputation rewards could work while third-party apps cannot mint
  native Status Karma directly.
- **Gasless-ready transactions:** memory saves are prepared through
  `linea_estimateGas`, matching the Status gasless path.
- **RLN fit:** memory capture is a frequent lightweight action, so Status
  Network's Karma and RLN model is a natural fit for supporting repeated
  entries while constraining abusive throughput at the network layer.

Matjip Karma is not official Status Karma and does not control real Status
Network gasless eligibility. It is a hackathon demo layer for showing how
contribution-based app reputation could work once native app rewards are
available.

## Status Hoodi Gasless Status

Status Network Hoodi currently has an RLN prover registration bug where fully
gasless transactions can fail with:

```text
RLN prover rejected transaction (NOT_FOUND): Sender not registered
```

Matjip follows the current Status builder guidance for this outage:

- call `linea_estimateGas` with the connected wallet as `from`
- use the returned `gas`, `maxFeePerGas`, and `maxPriorityFeePerGas`
- submit with paid gas until the Status-side RLN prover issue is fixed

The app integration lives in `src/lib/wallet/statusGas.ts`, and the memory save
flow applies the returned estimate before calling `MemoryRegistry.createMemory`.
Once Hoodi gasless sender registration is fixed, this same estimate-first flow is
the intended production path for gasless saves.

## Deployed Contracts

Network: Status Network Hoodi

| Contract | Address |
| --- | --- |
| MockKarma | `0x39eee569c1f2c28f86e79d38b3ed350488bac908` |
| MemoryRegistry | `0x33e8142b8951d3ebaf078a4245e8f107cc8024da` |

Chain details:

```text
Chain ID: 374
RPC: https://public.hoodi.rpc.status.network/
Explorer: https://hoodiscan.status.network
```

Latest deployment source:

```text
contract/broadcast/MatjipMemoryMap.s.sol/374/run-latest.json
```

## App Flow

1. Connect a wallet on Status Network Hoodi.
2. Add memory photos, details, and a location.
3. The app uploads cleaned image files and metadata to IPFS through Pinata.
4. The wallet calls `MemoryRegistry.createMemory(...)`.
5. The map reveals labelled areas around memories and connected routes.
6. If 5 nearby unclaimed memories connect, `MemoryRegistry` mints +3 Matjip
   Karma to the wallet that created the triggering memory.

## Builder Quest Evidence

These Hoodi transactions used the Status-supported paid fallback while the RLN
prover bug prevents fully gasless submission. Each app transaction was prepared
through `linea_estimateGas` before wallet confirmation.

Deployment:

- MockKarma:
  `0x0390d50a200838f8d83bee5c13d06a24284196ba6455f8ab44519743218e48a6`
- MemoryRegistry:
  `0xb0943f6f4c31b85df5a29df4bdfdc202b3e82a0a7fbdb5002b0a8ab212efc0db`
- Set MockKarma minter:
  `0x85f093614c5bdfd69607cd29103bca12022f854ad436fee447e8aa1a6d419126`

Core app transactions:

- `createMemory`:
  `0xef2c97777c33fc0ae6f3f7461ff3926304670bc750e766115840e681870d6072`
- `createMemory`:
  `0x114be415907c475806ec9bcdd9c4e3fe05eb0014e1cb34d787e3707a6ddffc94`
- `createMemory`:
  `0x724aa305f3dd8ac828d8119875e841a5d3d63afa2350281ab08d8d793a4499cc`
- `createMemory`:
  `0xdb0bc23d6a0b82fb33ece1a8aef9698c59dc5a36b2fbcb222ea20dc2e0d82b74`
- `createMemory` and `KarmaRewarded`:
  `0x02c0a6ff3c851c2fd27eb733faf00ba40b42d016f5ffefb4d18d67c598cf4859`

Additional live saves:

- `0x635d6b1a100d121ed68f0af3169f7c7747343ff2e0ca03f95b2a5cc326c970a9`
- `0x71d4dd3a5dad23aa1d9e6d788766b1574b4584df2ded3ae6baa5939068da1d31`

Explorer: https://hoodiscan.status.network

## Environment

Create `.env.local` in the project root:

```shell
PINATA_JWT=
NEXT_PUBLIC_GATEWAY_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_REOWN_PROJECT_ID=
STATUS_HOODI_RPC_URL=https://public.hoodi.rpc.status.network/
NEXT_PUBLIC_STATUS_RPC_URL=https://public.hoodi.rpc.status.network/
NEXT_PUBLIC_STATUS_CHAIN_ID=374
NEXT_PUBLIC_STATUS_EXPLORER_URL=https://hoodiscan.status.network
NEXT_PUBLIC_MOCK_KARMA_ADDRESS=0x39eee569c1f2c28f86e79d38b3ed350488bac908
NEXT_PUBLIC_MEMORY_REGISTRY_ADDRESS=0x33e8142b8951d3ebaf078a4245e8f107cc8024da
NEXT_PUBLIC_KARMA_ADDRESS=0x0700be6f329cc48c38144f71c898b72795db6c1b
NEXT_PUBLIC_KARMA_TIERS_ADDRESS=0xb8039632e089dcefa6bbb1590948926b2463b691
```

`PINATA_JWT` is required for memory uploads. `NEXT_PUBLIC_GATEWAY_URL` is
optional; if unset, IPFS URLs fall back to the public IPFS gateway.

## Development

Install dependencies:

```shell
npm install
```

Run the dev server:

```shell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Checks

Frontend:

```shell
npm run lint
npm run build
```

Contracts:

```shell
cd contract
forge test
```

## Contract Deployment

See [`contract/README.md`](contract/README.md) for Solidity details and deploy
commands.

Deployments currently use the same paid Hoodi fallback because of the Status
RLN prover bug described above:

```shell
forge script script/MatjipMemoryMap.s.sol:MatjipMemoryMapScript \
  --rpc-url https://public.hoodi.rpc.status.network/ \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --with-gas-price 200gwei \
  --priority-gas-price 100gwei \
  --slow
```

After redeploying, update both frontend environment variables:

```shell
NEXT_PUBLIC_MOCK_KARMA_ADDRESS=<new_mock_karma_address>
NEXT_PUBLIC_MEMORY_REGISTRY_ADDRESS=<new_memory_registry_address>
```

Old memories do not automatically migrate to a new `MemoryRegistry`.

## Vercel

The production branch should be `main`.

Live deployment:

```text
https://matjip-seven.vercel.app/
```

Set the same environment variables in the Vercel project settings, especially:

```shell
PINATA_JWT
NEXT_PUBLIC_REOWN_PROJECT_ID
NEXT_PUBLIC_MOCK_KARMA_ADDRESS
NEXT_PUBLIC_MEMORY_REGISTRY_ADDRESS
NEXT_PUBLIC_STATUS_RPC_URL
NEXT_PUBLIC_GATEWAY_URL
```

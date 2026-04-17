# Matjip

Matjip is a memory map on Status Network Hoodi. Users connect a wallet, add a
photo memory, upload metadata and images to IPFS, then anchor the memory
on-chain with location coordinates.

The app also includes a hackathon demo reward system called Matjip Karma. It is
a mock soulbound Karma token that mirrors Status Karma tiers while third-party
app reward minting is not available. When 5 nearby memories connect on the map,
the triggering wallet earns +3 Matjip Karma.

Matjip Karma is not official Status Karma and does not control real Status
Network gasless eligibility.

## Live Demo

https://matjip-seven.vercel.app/

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

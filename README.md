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

Deployments use premium Hoodi fees:

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

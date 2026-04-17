# Matjip Contracts

Foundry contracts for anchoring Matjip memories on Status Network Hoodi.

## MemoryRegistry

`MemoryRegistry` is deployed once, then the web app calls the same deployed
contract for every saved memory.

The contract stores only a small public anchor:

- poster address (`msg.sender`)
- IPFS metadata CID
- metadata hash
- rounded latitude and longitude in E6 format
- block timestamp

Photos, title, description, and location text stay offchain in Pinata/IPFS
metadata. IPFS CIDs are public, so private memories should encrypt metadata
and images before uploading to Pinata.

## API

```solidity
function createMemory(
    string calldata metadataCid,
    bytes32 metadataHash,
    int32 latE6,
    int32 lngE6
) external returns (uint256 memoryId);
```

`memoryId` is zero-based. The first memory returns `0`, the second returns `1`,
and `memoryCount()` returns the total number of memories.

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

## Matjip Karma Demo

`MockKarma` is a demo-only soulbound token that mirrors the Status Karma
experience while third-party app reward minting is not available. The deploy
script deploys `MockKarma`, then `MemoryRegistry`, then sets the registry as
the only minter.

When `createMemory` creates a connected group of 5 unclaimed nearby memories,
`MemoryRegistry` mints 3 Matjip Karma to the wallet that added the triggering
memory. The demo connection threshold is approximately 400m. Claimed memories
can still connect future groups, but each memory only counts toward one reward.

Set both frontend addresses after deployment:

```shell
NEXT_PUBLIC_MOCK_KARMA_ADDRESS=<deployed_mock_karma_address>
NEXT_PUBLIC_MEMORY_REGISTRY_ADDRESS=<deployed_contract_address>
```

Matjip Karma is not official Status Karma and does not control real sequencer
gasless eligibility.

## Hoodi Gasless Fallback

Status Network Hoodi currently has an RLN prover registration bug where fully
gasless transactions can fail with:

```text
RLN prover rejected transaction (NOT_FOUND): Sender not registered
```

The current Status builder guidance is to keep the production integration in
place by calling `linea_estimateGas`, then submit with the returned gas values
and paid gas until the prover issue is fixed. Matjip follows that flow in the
web app before calling `createMemory`.

## Deployed Contracts

Latest Status Hoodi deployment:

```text
MockKarma: 0x39eee569c1f2c28f86e79d38b3ed350488bac908
MemoryRegistry: 0x33e8142b8951d3ebaf078a4245e8f107cc8024da
```

Latest deployment source:

```text
broadcast/MatjipMemoryMap.s.sol/374/run-latest.json
```

Redeploying creates a new `MemoryRegistry`; old memories do not automatically
migrate to the new registry.

## Status Hoodi

Karma and gasless eligibility are handled by Status Network, not by this
contract. The frontend/backend checks the user's Karma and estimates the
transaction from the user's Karma-bearing wallet with `linea_estimateGas`.
During the Hoodi RLN outage, the app uses the returned estimate as a paid
fallback; after the network fix, the same estimate-first path is the gasless
submission path.

Hoodi chain ID:

```text
374
```

## Environment

Create `contract/.env` or export these values before deployment:

```shell
PRIVATE_KEY=
HOODI_RPC_URL=
```

After deployment, set these in the web app:

```shell
NEXT_PUBLIC_MOCK_KARMA_ADDRESS=<deployed_mock_karma_address>
NEXT_PUBLIC_MEMORY_REGISTRY_ADDRESS=<deployed_memory_registry_address>
```

## Commands

Run tests:

```shell
forge test
```

Build:

```shell
forge build
```

Deploy to Status Hoodi with the current paid fallback:

```shell
forge script script/MatjipMemoryMap.s.sol:MatjipMemoryMapScript \
  --rpc-url $HOODI_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --with-gas-price 200gwei \
  --priority-gas-price 100gwei \
  --slow
```

The deploy script uses the private key passed by the Foundry CLI.

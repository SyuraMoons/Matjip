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

## Status Hoodi

Karma and gasless eligibility are handled by Status Network, not by this
contract. The frontend/backend should check the user's Karma and estimate the
transaction from the user's Karma-bearing wallet. Eligible users can call
`createMemory` gaslessly on Hoodi.

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

After deployment, set this in the web app:

```shell
NEXT_PUBLIC_MEMORY_REGISTRY_ADDRESS=<deployed_contract_address>
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

Deploy to Status Hoodi:

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

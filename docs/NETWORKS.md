# Networks

The site can run on several networks at once. Each initiative lives on one network, its funds stay there, and
Explore lists them all together with a network label on each card. When someone acts on an initiative their wallet is
asked to switch to that initiative's network at that moment.

## Choosing the networks

Set `NEXT_PUBLIC_NETWORKS` (Vercel: Project, Settings, Environment Variables) to a comma separated list:

| Value | Meaning |
| --- | --- |
| *(not set)* | Sepolia demo only |
| `base,arbitrum,optimism` | The three real networks |
| `sepolia,base` | Any mix of: `sepolia`, `base`, `arbitrum`, `optimism`, `hardhat` |

Do not mix test and real networks in one list: the demo notice and the test-token button assume all or none.

A network only appears once the contract is deployed on it (see below).

Optional, recommended for a real launch: your own RPC endpoints, one variable per network, so the site does not depend
on shared public endpoints: `NEXT_PUBLIC_RPC_8453` (Base), `NEXT_PUBLIC_RPC_42161` (Arbitrum),
`NEXT_PUBLIC_RPC_10` (Optimism), `NEXT_PUBLIC_RPC_11155111` (Sepolia). Also set `NEXT_PUBLIC_ALCHEMY_API_KEY`.

## Deploying to a network

```
cd packages/hardhat
yarn deploy --network base
yarn verify --network base
```

- On Base, Arbitrum and Optimism the script uses Circle's USDC (addresses in `rocketh/plan.ts`) and small beta limits:
  500 USDC largest goal, 5,000 USDC held in total, 1 USDC minimum contribution.
- To change them for a deployment: `POOLS_MAX_GOAL=250 POOLS_TOTAL_CAP=2500 yarn deploy --network base`
  (amounts in USDC). **The limits are fixed in the contract.** Raising them means deploying a new contract.
- On Sepolia and local chains the script deploys a free test USDC and generous limits.
- The deployer account needs ETH on that network for gas.
- After each deployment `packages/nextjs/contracts/deployedContracts.ts` is regenerated. Commit it together with
  `packages/hardhat/deployments/`.
- After `yarn verify` succeeds, add the chain id to `VERIFIED_CHAIN_IDS` in `packages/nextjs/lib/site.ts` so the site
  shows the "Verified" badge.

## Adding another network

1. Add it to `AVAILABLE` in `packages/nextjs/scaffold.config.ts`.
2. Add its name, link slug, label and colour to `META` in `packages/nextjs/lib/chains.ts`, and its USDC address to
   `REAL_USDC` (or let the deploy create a test token if it is a test network).
3. Add its USDC address to `REAL_USDC` in `packages/hardhat/rocketh/plan.ts` and a network entry in
   `packages/hardhat/hardhat.config.ts` if it is not already there.
4. Deploy, then list it in `NEXT_PUBLIC_NETWORKS`.

## Links

Initiative links name the network: `/initiative/base-12`. Older links with just a number (`/initiative/12`) open the
first network in the list.

## Before raising any limit or promoting a real network

- Independent security audit of `MilestonePools.sol`.
- Check the USDC addresses again against Circle's published list.
- Run a full test: create, fund, submit, approve, withdraw, and a refund, on that network with small amounts.
- Terms and legal review for the places you serve.

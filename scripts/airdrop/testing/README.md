# Frontend integration testing on forked Mainnet

## Overview

Contracts are deployed onto Mainnet at the addresses given in `scripts/airdrop/addresses.json`.

Before the airdrop can begin, these three things have to happen:

1. Airdrop Minter has to be given locker permission by the APY token owner.
2. Airdrop Minter has to be given DAO token (CXD) minter role by the default admin (Protocol Safe)
3. `lockEnd` on the APY token has to be set to a future date

The first two are needed for the Airdrop Minter to mint the tokens. The last is what actually
activates the airdrop period.

The two included scripts will do the setup of permissions and setting of `lockEnd`.

## Forked Mainnet

All commmands are assumed to run from the root of the repo. You should have run `yarn` to install
all the dependencies and have the proper `.env` containing an Alchemy API key (check the hardhat config
for details).

To run the forked mainnet, in the terminal:

`ENABLE_FORKING=true yarn hardhat node`

In another terminal, run the setup scripts:

- `HARDHAT_NETWORK=localhost node scripts/airdrop/testing/setup_airdrop_minter.js`
- `HARDHAT_NETWORK=localhost node scripts/airdrop/testing/set_lockend.js --lockEnd=<timestamp>`

For the `lockEnd` timestamp, in the OS X terminal, this should work:

- `date +%s` should give the current timestamp.
- `expr 1650141347 + 30 \* 86400` will add 30 days to 1650141347

If the `lockEnd` arg is omitted, it will default to 7 days from the current block timestamp.

You can test everything works by running the mint script:

`HARDHAT_NETWORK=localhost node scripts/airdrop/testing/mint.js`

This will revert when the airdrop is not active and mint to the deployer account when it is.

// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.8.9;

import {
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable
} from "contracts/proxy/Imports.sol";

contract DaoTokenStorage is
    Initializable,
    OwnableUpgradeable,
    ERC20Upgradeable
{
    /** @notice Account allowed to mint tokens. */
    address public minter;
    /** @notice The cap on the token's total supply. */
    uint256 public supplyCap;
}

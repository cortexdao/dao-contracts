// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.8.9;

import {
    AccessControlEnumerableUpgradeable,
    ERC20Upgradeable,
    Initializable
} from "contracts/proxy/Imports.sol";

contract DaoTokenStorage is
    Initializable,
    AccessControlEnumerableUpgradeable,
    ERC20Upgradeable
{
    /** @notice The cap on the token's total supply. */
    uint256 public supplyCap;
}

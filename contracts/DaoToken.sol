// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {IDetailedERC20} from "contracts/common/Imports.sol";
import {SafeERC20} from "contracts/libraries/Imports.sol";
import {
    Initializable,
    ERC20UpgradeSafe,
    OwnableUpgradeSafe,
    Address as AddressUpgradeSafe,
    SafeMath as SafeMathUpgradeSafe,
    SignedSafeMath as SignedSafeMathUpgradeSafe
} from "contracts/proxy/Imports.sol";

contract DaoToken is Initializable, OwnableUpgradeSafe, ERC20UpgradeSafe {
    function initialize() external initializer {
        // initialize ancestor storage
        __Context_init_unchained();
        __Ownable_init_unchained();
        __ERC20_init_unchained("Cortex DAO Token", "CXD");

        // initialize impl-specific storage
    }

    // solhint-disable-next-line no-empty-blocks
    function initializeV2() external virtual onlyProxyAdmin {}

    // solhint-disable-next-line no-empty-blocks
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

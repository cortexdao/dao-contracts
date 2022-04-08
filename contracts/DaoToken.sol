// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.8.9;

import {IDetailedERC20} from "contracts/common/Imports.sol";
import {SafeERC20} from "contracts/libraries/Imports.sol";
import {
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    AddressUpgradeable
} from "contracts/proxy/Imports.sol";

contract DaoToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
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

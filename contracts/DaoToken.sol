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
    uint256 private _supplyCap;

    function initialize(uint256 supplyCap) external initializer {
        // initialize ancestor storage
        __Context_init_unchained();
        __Ownable_init_unchained();
        __ERC20_init_unchained("Cortex DAO Token", "CXD");

        // initialize impl-specific storage
        _setSupplyCap(supplyCap);
    }

    // solhint-disable-next-line no-empty-blocks
    function initializeV2() external virtual onlyProxyAdmin {}

    // solhint-disable-next-line no-empty-blocks
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setSupplyCap(uint256 newCap) external onlyOwner {
        _setSupplyCap(newCap);
    }

    /**
     * @dev Returns the cap on the token's total supply.
     */
    function supplyCap() public view virtual returns (uint256) {
        return _supplyCap;
    }

    function _mint(address account, uint256 amount) internal virtual override {
        require(
            ERC20Upgradeable.totalSupply() + amount <= supplyCap(),
            "SUPPLY_CAP_EXCEEDED"
        );
        ERC20Upgradeable._mint(account, amount);
    }

    function _setSupplyCap(uint256 newCap) internal {
        require(newCap > 0, "ZERO_SUPPLY_CAP");
        require(newCap > ERC20Upgradeable.totalSupply(), "INVALID_SUPPLY_CAP");
        _supplyCap = newCap;
    }
}

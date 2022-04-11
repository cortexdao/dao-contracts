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
    /** @notice Account allowed to mint tokens. */
    address public minter;
    /** @notice The cap on the token's total supply. */
    uint256 public supplyCap;

    modifier onlyMinter() {
        require(msg.sender == minter, "MINTER_ONLY");
        _;
    }

    function initialize() external initializer {
        // initialize ancestor storage
        __Context_init_unchained();
        __Ownable_init_unchained();
        __ERC20_init_unchained("Cortex DAO Token", "CXD");

        // initialize impl-specific storage
        _setSupplyCap(271828182e18);
    }

    // solhint-disable-next-line no-empty-blocks
    function initializeV2() external virtual onlyProxyAdmin {}

    // FIXME: protect with minter permission
    /**
     * @notice Mint tokens to specified account.  Cannot exceed the supply cap.
     * @dev Can only be used by account set as `minter`.  This should be the
     * smart contract that disburses the liquidity mining rewards.
     */
    function mint(address account, uint256 amount) external onlyMinter {
        _mint(account, amount);
    }

    function setMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "INVALID_ADDRESS");
        minter = newMinter;
    }

    /**
     * @notice Set the new supply cap as determined by governance.
     * @dev New cap cannot be less than existing supply.
     */
    function setSupplyCap(uint256 newCap) external onlyOwner {
        _setSupplyCap(newCap);
    }

    function _mint(address account, uint256 amount) internal virtual override {
        require(
            ERC20Upgradeable.totalSupply() + amount <= supplyCap,
            "SUPPLY_CAP_EXCEEDED"
        );
        ERC20Upgradeable._mint(account, amount);
    }

    function _setSupplyCap(uint256 newCap) internal {
        require(newCap > 0, "ZERO_SUPPLY_CAP");
        require(newCap > ERC20Upgradeable.totalSupply(), "INVALID_SUPPLY_CAP");
        supplyCap = newCap;
    }
}

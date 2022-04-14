// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.8.9;

import {DaoTokenStorage} from "contracts/DaoTokenStorage.sol";

contract DaoToken is DaoTokenStorage {
    event NewMinter(address newMinter);
    event NewSupplyCap(uint256 newCap);

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

    /**
     * @notice Mint tokens to specified account.  Cannot exceed the supply cap.
     * @dev Can only be used by account set as `minter`.  This should be the
     * smart contract that disburses the liquidity mining rewards.
     */
    function mint(address account, uint256 amount) external onlyMinter {
        _mint(account, amount);
    }

    /**
     * @notice Set the address allowed to mint token.
     */
    function setMinter(address newMinter) external onlyOwner {
        _setMinter(newMinter);
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
            super.totalSupply() + amount <= supplyCap,
            "SUPPLY_CAP_EXCEEDED"
        );
        super._mint(account, amount);
    }

    function _setMinter(address newMinter) internal {
        require(newMinter != address(0), "INVALID_ADDRESS");
        minter = newMinter;
        emit NewMinter(newMinter);
    }

    function _setSupplyCap(uint256 newCap) internal {
        require(newCap > 0, "ZERO_SUPPLY_CAP");
        require(newCap > super.totalSupply(), "INVALID_SUPPLY_CAP");
        supplyCap = newCap;
        emit NewSupplyCap(newCap);
    }
}

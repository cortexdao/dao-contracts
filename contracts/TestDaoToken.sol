// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.8.9;

import {DaoToken} from "contracts/DaoToken.sol";

contract TestDaoToken is DaoToken {
    function testMint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

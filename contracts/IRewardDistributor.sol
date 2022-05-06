// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IRewardDistributor {
    struct Recipient {
        uint256 nonce;
        address wallet;
        uint256 amount;
    }

    function claim(
        Recipient calldata recipient,
        uint8 v,
        bytes32 r,
        bytes32 s // bytes calldata signature
    ) external;

    function setSigner(address signer) external;

    function owner() external view returns (address);
}

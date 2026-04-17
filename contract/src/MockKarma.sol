// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockKarma {
    error NotOwner();
    error NotMinter();
    error Soulbound();
    error ZeroAddress();

    string public constant name = "Matjip Karma";
    string public constant symbol = "mKARMA";
    uint8 public constant decimals = 18;

    address public immutable owner;
    address public minter;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event MinterUpdated(address indexed minter);

    constructor() {
        owner = msg.sender;
    }

    function setMinter(address newMinter) external {
        if (msg.sender != owner) revert NotOwner();
        if (newMinter == address(0)) revert ZeroAddress();

        minter = newMinter;
        emit MinterUpdated(newMinter);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        if (to == address(0)) revert ZeroAddress();

        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address, uint256) external pure returns (bool) {
        revert Soulbound();
    }

    function approve(address, uint256) external pure returns (bool) {
        revert Soulbound();
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert Soulbound();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IPoolsLike {
    function withdraw(address token) external;
    function refund(uint256 id) external;
    function contribute(uint256 id, uint256 amount) external;
}

/// @notice Test-only hostile token. When armed, it calls back into the pool in the middle of a
///         transfer to the target. The pool's reentrancy guard must make the whole call revert.
contract ReenteringToken is ERC20 {
    enum Attack {
        None,
        Withdraw,
        Refund,
        Contribute
    }

    IPoolsLike public pool;
    Attack public attack;
    address public victim; // transfers to this address trigger the callback
    uint256 public attackId;

    constructor() ERC20("Reentering Token", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address pool_, Attack attack_, address victim_, uint256 id_) external {
        pool = IPoolsLike(pool_);
        attack = attack_;
        victim = victim_;
        attackId = id_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (attack != Attack.None && to == victim && from == address(pool)) {
            Attack a = attack;
            attack = Attack.None; // one shot, to avoid infinite recursion if the guard failed
            if (a == Attack.Withdraw) pool.withdraw(address(this));
            else if (a == Attack.Refund) pool.refund(attackId);
            else pool.contribute(attackId, 1);
        }
    }
}
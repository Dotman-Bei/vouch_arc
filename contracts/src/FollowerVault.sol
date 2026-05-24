// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Circle USYC Teller surface for Arc testnet subscriptions/redemptions.
interface IUSYCTeller {
    function deposit(uint256 _assets, address _receiver) external returns (uint256);
    function redeem(uint256 _shares, address _receiver, address _account) external returns (uint256);
}

/// @title  FollowerVault
/// @notice Single-contract custody of all follower USDC across all leaders.
///         Idle USDC is parked in USYC for base yield. Per-leader returnIndex
///         tracks synthetic mirror PnL pushed by the agent; slash proceeds bump
///         the index directly, making followers whole before principal is touched.
contract FollowerVault {
    IERC20      public immutable usdc;
    IERC20      public immutable usyc;
    IUSYCTeller public immutable usycTeller;
    address     public agent;
    address     public bondRegistry;
    address     public owner;

    uint256 public constant MIN_DEPOSIT = 10e6; // 10 USDC
    uint256 public constant INDEX_UNIT  = 1e18;

    // shares[follower][leader] — follower's share count for that leader
    mapping(address => mapping(address => uint256)) public shares;
    // totalShares[leader]
    mapping(address => uint256) public totalShares;
    // returnIndex[leader] — 1e18 = par (synthetic value per share)
    mapping(address => uint256) public returnIndex;
    // usycShares[leader] — USYC shares held on behalf of this leader's pool
    mapping(address => uint256) public usycShares;
    // poolUsdc[leader] — real USDC capital backing the pool (deposits + slash
    // proceeds). Synthetic returnIndex gains above this are unfunded.
    mapping(address => uint256) public poolUsdc;

    event Deposit(address indexed follower, address indexed leader, uint256 usdcAmount, uint256 sharesMinted);
    event Withdraw(address indexed follower, address indexed leader, uint256 usdcAmount, uint256 sharesBurned);
    event ReturnIndexUpdated(address indexed leader, int256 returnBps, uint256 newIndex);
    event SlashReceived(address indexed leader, uint256 amount, uint256 newIndex);
    event AgentChanged(address indexed oldAgent, address indexed newAgent);

    modifier onlyAgent()        { require(msg.sender == agent,        "not agent"); _; }
    modifier onlyBondRegistry() { require(msg.sender == bondRegistry, "not registry"); _; }
    modifier onlyOwner()        { require(msg.sender == owner,        "not owner"); _; }

    constructor(address _usdc, address _usyc, address _usycTeller, address _agent) {
        require(_usdc != address(0) && _agent != address(0), "zero addr");
        usdc       = IERC20(_usdc);
        usyc       = IERC20(_usyc);
        usycTeller = IUSYCTeller(_usycTeller);
        agent      = _agent;
        owner      = msg.sender;
    }

    function setBondRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "registry=0");
        bondRegistry = _registry;
    }

    function setAgent(address _newAgent) external onlyOwner {
        require(_newAgent != address(0), "agent=0");
        emit AgentChanged(agent, _newAgent);
        agent = _newAgent;
    }

    function _parkInUSYC(address _leader, uint256 _amount) internal {
        if (address(usycTeller) == address(0)) return; // local/test mode
        require(usdc.approve(address(usycTeller), _amount), "approve usdc");
        uint256 y = usycTeller.deposit(_amount, address(this));
        usycShares[_leader] += y;
    }

    function _redeemUSYC(address _leader, uint256 _proRataBps) internal returns (uint256) {
        if (address(usycTeller) == address(0)) return 0;
        uint256 yTotal = usycShares[_leader];
        if (yTotal == 0) return 0;
        uint256 yToRedeem = (yTotal * _proRataBps) / 10000;
        if (yToRedeem == 0) return 0;
        usycShares[_leader] -= yToRedeem;
        require(usyc.approve(address(usycTeller), yToRedeem), "approve usyc");
        return usycTeller.redeem(yToRedeem, address(this), address(this));
    }

    /// @notice Follower deposits USDC and allocates to a specific leader.
    function deposit(address _leader, uint256 _amount) external {
        require(_amount >= MIN_DEPOSIT, "below min");
        require(_leader != address(0), "leader=0");

        require(usdc.transferFrom(msg.sender, address(this), _amount), "usdc xfer");

        if (returnIndex[_leader] == 0) returnIndex[_leader] = INDEX_UNIT;
        uint256 idx = returnIndex[_leader];
        uint256 minted = (_amount * INDEX_UNIT) / idx;

        shares[msg.sender][_leader] += minted;
        totalShares[_leader]        += minted;
        poolUsdc[_leader]           += _amount;

        _parkInUSYC(_leader, _amount);

        emit Deposit(msg.sender, _leader, _amount, minted);
    }

    /// @notice Agent-only: apply the leader's verified hourly return in bps.
    function updateReturnIndex(address _leader, int256 _returnBps) external onlyAgent {
        uint256 idx = returnIndex[_leader];
        if (idx == 0) return;
        int256 delta  = (int256(idx) * _returnBps) / 10000;
        int256 newIdx = int256(idx) + delta;
        if (newIdx < 0) newIdx = 0;
        returnIndex[_leader] = uint256(newIdx);
        emit ReturnIndexUpdated(_leader, _returnBps, uint256(newIdx));
    }

    /// @notice BondRegistry-only: receive a slash payout and bump the index
    ///         so followers are made whole pro-rata.
    function receiveSlash(address _leader, uint256 _amount) external onlyBondRegistry {
        uint256 ts = totalShares[_leader];
        if (ts == 0) return;
        uint256 bump = (_amount * INDEX_UNIT) / ts;
        returnIndex[_leader] += bump;
        poolUsdc[_leader]    += _amount;

        // Re-park the slash USDC into USYC alongside the rest of the pool.
        _parkInUSYC(_leader, _amount);

        emit SlashReceived(_leader, _amount, returnIndex[_leader]);
    }

    /// @notice Follower redeems shares for USDC at the current index.
    function withdraw(address _leader, uint256 _shares) external {
        uint256 held = shares[msg.sender][_leader];
        require(_shares > 0 && _shares <= held, "bad shares");

        uint256 idx       = returnIndex[_leader];
        uint256 usdcValue = (_shares * idx) / INDEX_UNIT;
        uint256 tsBefore  = totalShares[_leader];

        shares[msg.sender][_leader] = held - _shares;
        totalShares[_leader]        = tsBefore - _shares;

        // Share-fraction (bps) relative to the pre-burn total.
        uint256 proRataBps = (_shares * 10000) / tsBefore;

        // The follower withdraws the lesser of synthetic value and the real
        // capital backing their share — synthetic index gains are unfunded.
        uint256 payout;
        if (address(usycTeller) == address(0)) {
            // USYC disabled: USDC sits in the vault; backing is poolUsdc.
            uint256 realBacking = (poolUsdc[_leader] * proRataBps) / 10000;
            payout = usdcValue <= realBacking ? usdcValue : realBacking;
            poolUsdc[_leader] -= payout;
        } else {
            // USYC enabled: backing is whatever the redemption returns.
            uint256 redeemed = _redeemUSYC(_leader, proRataBps);
            payout = redeemed >= usdcValue ? usdcValue : redeemed;
        }
        require(usdc.transfer(msg.sender, payout), "usdc xfer");

        emit Withdraw(msg.sender, _leader, payout, _shares);
    }

    function positionValue(address _follower, address _leader) external view returns (uint256) {
        uint256 idx = returnIndex[_leader];
        if (idx == 0) return 0;
        return (shares[_follower][_leader] * idx) / INDEX_UNIT;
    }

    function tvl(address _leader) external view returns (uint256) {
        uint256 idx = returnIndex[_leader];
        if (idx == 0) return 0;
        return (totalShares[_leader] * idx) / INDEX_UNIT;
    }
}

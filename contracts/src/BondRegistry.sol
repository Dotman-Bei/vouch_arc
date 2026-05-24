// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFollowerVault {
    function receiveSlash(address leader, uint256 amount) external;
}

/// @title  BondRegistry
/// @notice Custody of leader USDC performance bonds + graduated slashing.
///         Only the agent may slash. Slashed USDC is pushed to FollowerVault,
///         which distributes via the per-leader returnIndex. Withdrawals are
///         locked for LOCK_DURATION from the post timestamp.
contract BondRegistry {
    IERC20         public immutable usdc;
    IFollowerVault public followerVault;
    address        public agent;
    address        public owner;

    uint256 public constant LOCK_DURATION = 30 days;
    uint256 public constant MIN_BOND      = 20e6;    // 20 USDC (6 decimals)
    uint256 public constant MAX_SLASH_BPS = 8000;    // 80% per slash event

    struct Bond {
        uint256 amount;       // current balance (post-slashes)
        uint256 postedAt;
        uint256 lockedUntil;
        bool    slashed;
        string  hlWallet;     // leader's Hyperliquid address (for agent fetch)
        string  handle;       // display handle / social
    }

    mapping(address => Bond) public bonds;
    address[] public bondedLeaders;

    event BondPosted(address indexed leader, uint256 amount, string handle, string hlWallet);
    event BondSlashed(address indexed leader, uint256 slashBps, uint256 slashAmount, uint256 remaining, bytes32 reasonHash);
    event BondWithdrawn(address indexed leader, uint256 amount);
    event AgentChanged(address indexed oldAgent, address indexed newAgent);

    modifier onlyAgent() { require(msg.sender == agent, "not agent"); _; }
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor(address _usdc, address _agent) {
        require(_usdc != address(0) && _agent != address(0), "zero addr");
        usdc  = IERC20(_usdc);
        agent = _agent;
        owner = msg.sender;
    }

    function setFollowerVault(address _vault) external onlyOwner {
        require(_vault != address(0), "vault=0");
        followerVault = IFollowerVault(_vault);
    }

    function setAgent(address _newAgent) external onlyOwner {
        require(_newAgent != address(0), "agent=0");
        emit AgentChanged(agent, _newAgent);
        agent = _newAgent;
    }

    /// @notice Leader posts an initial bond and registers their HL identity.
    function postBond(
        uint256 _amount,
        string calldata _hlWallet,
        string calldata _handle
    ) external {
        require(_amount >= MIN_BOND, "below minimum");
        require(bonds[msg.sender].amount == 0, "bond exists");
        require(bytes(_hlWallet).length > 0, "hlWallet empty");

        require(usdc.transferFrom(msg.sender, address(this), _amount), "usdc xfer");

        bonds[msg.sender] = Bond({
            amount:      _amount,
            postedAt:    block.timestamp,
            lockedUntil: block.timestamp + LOCK_DURATION,
            slashed:     false,
            hlWallet:    _hlWallet,
            handle:      _handle
        });
        bondedLeaders.push(msg.sender);
        emit BondPosted(msg.sender, _amount, _handle, _hlWallet);
    }

    /// @notice Agent-only: slash a fraction of the leader's remaining bond.
    /// @param  _slashBps basis points of CURRENT bond to slash (≤ MAX_SLASH_BPS).
    function slash(
        address _leader,
        uint256 _slashBps,
        bytes32 _reasonHash
    ) external onlyAgent {
        require(_slashBps > 0 && _slashBps <= MAX_SLASH_BPS, "bad bps");
        require(address(followerVault) != address(0), "vault unset");

        Bond storage b = bonds[_leader];
        require(b.amount > 0, "no bond");

        uint256 slashAmount = (b.amount * _slashBps) / 10000;
        require(slashAmount > 0, "zero slash");

        b.amount  -= slashAmount;
        b.slashed  = true;

        require(usdc.transfer(address(followerVault), slashAmount), "usdc xfer");
        followerVault.receiveSlash(_leader, slashAmount);

        emit BondSlashed(_leader, _slashBps, slashAmount, b.amount, _reasonHash);
    }

    /// @notice Leader withdraws their remaining bond after the lock expires.
    function withdraw() external {
        Bond storage b = bonds[msg.sender];
        require(b.amount > 0, "no bond");
        require(block.timestamp >= b.lockedUntil, "locked");

        uint256 amt = b.amount;
        b.amount = 0;
        require(usdc.transfer(msg.sender, amt), "usdc xfer");
        emit BondWithdrawn(msg.sender, amt);
    }

    function getBond(address _leader) external view returns (Bond memory) {
        return bonds[_leader];
    }

    function getBondedLeaderCount() external view returns (uint256) {
        return bondedLeaders.length;
    }

    function getAllBondedLeaders() external view returns (address[] memory) {
        return bondedLeaders;
    }

    /// @notice Helper for the frontend "slash risk meter" — computes the slash
    ///         amount a given bps would produce against the current bond.
    function previewSlash(address _leader, uint256 _slashBps) external view returns (uint256) {
        return (bonds[_leader].amount * _slashBps) / 10000;
    }
}

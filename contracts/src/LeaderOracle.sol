// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  LeaderOracle
/// @notice Single-source-of-truth on-chain state for agent-attested leader metrics.
///         The off-chain Vouch agent is the only authorized writer. Every update
///         emits an event so frontends can subscribe and avoid polling.
contract LeaderOracle {
    address public agent;
    address public owner;

    struct LeaderState {
        address leader;
        int256  lastReturnBps;   // signed: + gain, - loss, last hourly window
        uint256 lastUpdated;     // block.timestamp of most recent push
        bool    flagged;         // agent's degradation flag
        bytes32 reasonHash;      // keccak256 of off-chain JSON reasoning trace
        uint256 updateCount;     // monotonically increasing push count
    }

    mapping(address => LeaderState) public state;
    address[] public registeredLeaders;

    event Updated(address indexed leader, int256 returnBps, bool flagged, bytes32 reasonHash);
    event AgentChanged(address indexed oldAgent, address indexed newAgent);

    modifier onlyAgent() { require(msg.sender == agent, "not agent"); _; }
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor(address _agent) {
        require(_agent != address(0), "agent=0");
        agent = _agent;
        owner = msg.sender;
    }

    /// @notice Agent pushes a fresh hourly verdict for a leader.
    function pushUpdate(
        address _leader,
        int256  _returnBps,
        bool    _flagged,
        bytes32 _reasonHash
    ) external onlyAgent {
        require(_leader != address(0), "leader=0");
        LeaderState storage s = state[_leader];
        if (s.updateCount == 0) {
            s.leader = _leader;
            registeredLeaders.push(_leader);
        }
        s.lastReturnBps = _returnBps;
        s.lastUpdated   = block.timestamp;
        s.flagged       = _flagged;
        s.reasonHash    = _reasonHash;
        s.updateCount  += 1;
        emit Updated(_leader, _returnBps, _flagged, _reasonHash);
    }

    function setAgent(address _newAgent) external onlyOwner {
        require(_newAgent != address(0), "agent=0");
        emit AgentChanged(agent, _newAgent);
        agent = _newAgent;
    }

    function getLeaderCount() external view returns (uint256) {
        return registeredLeaders.length;
    }

    function getAllLeaders() external view returns (address[] memory) {
        return registeredLeaders;
    }

    function getLeaderState(address _leader) external view returns (LeaderState memory) {
        return state[_leader];
    }
}

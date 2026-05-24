export const LeaderOracleABI = [
  "function pushUpdate(address leader, int256 returnBps, bool flagged, bytes32 reasonHash) external",
  "function getAllLeaders() view returns (address[])",
  "function getLeaderState(address) view returns (tuple(address leader, int256 lastReturnBps, uint256 lastUpdated, bool flagged, bytes32 reasonHash, uint256 updateCount))",
  "event Updated(address indexed leader, int256 returnBps, bool flagged, bytes32 reasonHash)",
];

export const BondRegistryABI = [
  "function slash(address leader, uint256 slashBps, bytes32 reasonHash) external",
  "function getBond(address) view returns (tuple(uint256 amount, uint256 postedAt, uint256 lockedUntil, bool slashed, string hlWallet, string handle))",
  "function getAllBondedLeaders() view returns (address[])",
  "function getBondedLeaderCount() view returns (uint256)",
  "function bonds(address) view returns (uint256 amount, uint256 postedAt, uint256 lockedUntil, bool slashed, string hlWallet, string handle)",
  "event BondPosted(address indexed leader, uint256 amount, string handle, string hlWallet)",
  "event BondSlashed(address indexed leader, uint256 slashBps, uint256 slashAmount, uint256 remaining, bytes32 reasonHash)",
];

export const FollowerVaultABI = [
  "function updateReturnIndex(address leader, int256 returnBps) external",
  "function returnIndex(address) view returns (uint256)",
  "function totalShares(address) view returns (uint256)",
  "function tvl(address) view returns (uint256)",
  "event ReturnIndexUpdated(address indexed leader, int256 returnBps, uint256 newIndex)",
  "event SlashReceived(address indexed leader, uint256 amount, uint256 newIndex)",
];

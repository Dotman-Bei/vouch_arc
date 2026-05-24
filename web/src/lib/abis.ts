export const LeaderOracleABI = [
  "function getAllLeaders() view returns (address[])",
  "function getLeaderState(address) view returns (tuple(address leader, int256 lastReturnBps, uint256 lastUpdated, bool flagged, bytes32 reasonHash, uint256 updateCount))",
  "event Updated(address indexed leader, int256 returnBps, bool flagged, bytes32 reasonHash)",
];

export const BondRegistryABI = [
  "function postBond(uint256 amount, string hlWallet, string handle) external",
  "function withdraw() external",
  "function getBond(address) view returns (tuple(uint256 amount, uint256 postedAt, uint256 lockedUntil, bool slashed, string hlWallet, string handle))",
  "function getAllBondedLeaders() view returns (address[])",
  "function getBondedLeaderCount() view returns (uint256)",
  "function MIN_BOND() view returns (uint256)",
  "event BondPosted(address indexed leader, uint256 amount, string handle, string hlWallet)",
  "event BondSlashed(address indexed leader, uint256 slashBps, uint256 slashAmount, uint256 remaining, bytes32 reasonHash)",
];

export const FollowerVaultABI = [
  "function deposit(address leader, uint256 amount) external",
  "function withdraw(address leader, uint256 shares) external",
  "function shares(address follower, address leader) view returns (uint256)",
  "function totalShares(address) view returns (uint256)",
  "function returnIndex(address) view returns (uint256)",
  "function positionValue(address follower, address leader) view returns (uint256)",
  "function tvl(address leader) view returns (uint256)",
];

export const ERC20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

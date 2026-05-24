"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

// RainbowKit connect/account button rendered with the app's own button styles
// so it matches the mono / dark / green theme instead of RainbowKit defaults.
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        return (
          <div
            className="flex items-center"
            {...(!ready && { "aria-hidden": true, style: { opacity: 0, pointerEvents: "none", userSelect: "none" } })}
          >
            {!connected ? (
              <button className="btn-primary" onClick={openConnectModal}>
                connect wallet
              </button>
            ) : chain.unsupported ? (
              <button
                className="btn-primary"
                onClick={openChainModal}
                style={{ background: "var(--status-danger)" }}
              >
                wrong network
              </button>
            ) : (
              <button className="btn-primary tabular" onClick={openAccountModal}>
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/leaderboard",   label: "leaderboard" },
  { href: "/agent",         label: "agent" },
  { href: "/app/dashboard", label: "app" },
  { href: "/app/leader",    label: "become a leader" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Fixed header — page content scrolls underneath the frosted bar */}
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-line backdrop-blur-md"
        style={{ background: "rgba(12, 12, 10, 0.8)" }}
      >
        <div
          className="mx-auto flex h-[72px] items-center justify-between gap-6 px-6 md:px-10"
          style={{ maxWidth: 860 }}
        >
          <Link
            href="/"
            onClick={close}
            className="shrink-0 text-lg font-bold tracking-tight no-underline"
          >
            vouch<span className="text-accent-green">.</span>
          </Link>

          {/* Desktop: inline links + wallet */}
          <nav className="hidden items-center gap-8 text-sm md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="whitespace-nowrap text-fg-secondary no-underline transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden shrink-0 md:block">
            <WalletButton />
          </div>

          {/* Mobile: hamburger toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[5px] md:hidden"
          >
            <span
              className={`block h-[2px] w-5 bg-fg-primary transition-transform duration-200 ${
                open ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-[2px] w-5 bg-fg-primary transition-opacity duration-200 ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-[2px] w-5 bg-fg-primary transition-transform duration-200 ${
                open ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>

        {/* Mobile: collapsible panel */}
        {open && (
          <nav
            className="border-t border-line md:hidden"
            style={{ background: "rgba(12, 12, 10, 0.97)" }}
          >
            <div
              className="mx-auto flex flex-col px-6 py-3"
              style={{ maxWidth: 860 }}
            >
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="py-3 text-sm text-fg-secondary no-underline transition-colors hover:text-accent-green"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 border-t border-line pt-4">
                <WalletButton />
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* Spacer: offsets the fixed header so the page starts below it */}
      <div aria-hidden className="h-[73px] shrink-0" />
    </>
  );
}

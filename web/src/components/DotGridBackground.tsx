"use client";

import DotGrid from "@/components/DotGrid";

/**
 * Fixed, full-viewport DotGrid layer rendered behind all page content.
 * The canvas is transparent, so the body background (--bg-primary) shows
 * through; opaque cards/sections sit on top and hide the dots beneath them.
 *
 * Uses explicit 100vw/100vh sizing so the canvas's percentage-height chain
 * resolves to a definite size (otherwise the grid collapses to 0 rows).
 */
export function DotGridBackground() {
  return (
    <div
      aria-hidden
      className="fixed left-0 right-0 top-0 -z-10 pointer-events-none"
      style={{ height: "100vh" }}
    >
      <DotGrid
        dotSize={5}
        gap={26}
        baseColor="#3a3a30"
        activeColor="#c8e665"
        proximity={130}
        shockRadius={230}
        shockStrength={4}
        returnDuration={1.4}
      />
    </div>
  );
}

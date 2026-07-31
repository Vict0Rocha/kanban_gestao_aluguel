"use client"

// @base-ui/react 1.6 never removes the [data-starting-style] attribute it
// sets on mount, so its animation-finished detection (used to know when to
// unmount a closed popup/dialog/sheet) waits forever for an attribute
// change that never happens — closed overlays get stuck in the DOM.
// This documented escape hatch skips that wait and unmounts immediately
// instead. Safe to remove once a future @base-ui/react release fixes the
// underlying lifecycle bug (checked against 1.6.0, the latest as of writing).
declare global {
  interface Window {
    BASE_UI_ANIMATIONS_DISABLED?: boolean
  }
}

if (typeof window !== "undefined") {
  window.BASE_UI_ANIMATIONS_DISABLED = true
}

// A rendered (not just imported) component so bundlers reliably include
// and execute this module even when the only importer is a Server
// Component — a bare side-effect import isn't guaranteed to run there.
export function BaseUiAnimationsWorkaround() {
  return null
}

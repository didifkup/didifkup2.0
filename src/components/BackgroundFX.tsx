import { useReducedMotion } from "framer-motion"

/**
 * Signature backdrop: soft gradient blobs, faint grid, tasteful grain.
 * pointer-events-none, respects prefers-reduced-motion (no blob motion).
 */
export function BackgroundFX() {
  const reduceMotion = useReducedMotion()

  return (
    <div
      className="bg-fx-backdrop fixed inset-0 pointer-events-none z-0"
      aria-hidden
    >
      {/* Soft animated gradient blobs — very subtle, slow */}
      {!reduceMotion && (
        <>
          <div className="bg-fx-blob bg-fx-blob-1" />
          <div className="bg-fx-blob bg-fx-blob-2" />
          <div className="bg-fx-blob bg-fx-blob-3" />
        </>
      )}

      {/* Faint dotted grid behind content */}
      <div className="bg-fx-grid absolute inset-0 opacity-[0.5]" aria-hidden />

      {/* Tasteful grain overlay — lower opacity, correct stacking */}
      <div className="bg-fx-grain absolute inset-0 z-[1]" />
    </div>
  )
}

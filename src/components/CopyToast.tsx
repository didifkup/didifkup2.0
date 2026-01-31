import { motion, AnimatePresence } from "framer-motion"

interface CopyToastProps {
  show: boolean
  className?: string
}

/** Local "copied" pill that animates in near the button. */
export function CopyToast({ show, className = "" }: CopyToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.9, y: 2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-lime-500 px-3 py-1.5 text-xs font-bold text-white shadow-md whitespace-nowrap ${className}`}
          role="status"
          aria-live="polite"
        >
          Copied!
        </motion.span>
      )}
    </AnimatePresence>
  )
}

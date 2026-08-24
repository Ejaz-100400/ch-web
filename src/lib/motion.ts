import type { Variants } from "framer-motion";

// Shared, subtle motion vocabulary for list rows across the app -- short
// durations and small offsets on purpose (see the artifact/UI guidance:
// comfort over spectacle). staggerChildren on the container gives each row
// a slight cascade in; AnimatePresence + the item's exit variant lets a row
// animate OUT when it's deleted or filtered away, which plain CSS mount
// animations can't do.
export const listContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.025 } },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.15, ease: "easeIn" } },
};

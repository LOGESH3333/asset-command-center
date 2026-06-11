"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends HTMLMotionProps<"div"> {
  strong?: boolean;
  hover?: boolean;
}

export function GlassPanel({
  className,
  strong,
  hover,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-2xl dark:bm-card",
        strong ? "glass-panel-strong" : "glass-panel",
        hover && "bm-card-hover hover-lift cursor-default",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

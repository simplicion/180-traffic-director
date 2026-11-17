'use client';

import React from 'react';
import { motion, AnimatePresence, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';

/**
 * Unified Organic Motion Physics Tokens
 * Shared across the entire 180 Traffic Director platform so every drawer,
 * card, tab pill, progress bar, modal, and page transition feels alive & cohesive.
 */
export const SPRING_ORGANIC = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 30,
  mass: 0.72,
};

export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 34,
  mass: 0.58,
};

export const SPRING_TACTILE = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 26,
};

export const EASE_FLUID: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Smooth spring-filled capacity / quota bar with subtle living sheen.
 */
export function AliveProgressBar({
  percent,
  colorClass,
  heightClass = 'h-2',
  className,
  shimmer = true,
}: {
  percent: number;
  colorClass?: string;
  heightClass?: string;
  className?: string;
  shimmer?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const resolvedColor =
    colorClass ||
    (clamped >= 90
      ? 'bg-gradient-to-r from-rose-500 to-red-500'
      : clamped >= 70
      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
      : 'bg-gradient-to-r from-emerald-500 to-teal-400');

  return (
    <div
      className={clsx(
        'w-full bg-zinc-200/90 dark:bg-zinc-800/90 rounded-full overflow-hidden relative',
        heightClass,
        className
      )}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22, mass: 0.85 }}
        className={clsx('h-full rounded-full relative overflow-hidden', resolvedColor)}
      >
        {shimmer && clamped > 2 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-td-shimmer"
          />
        )}
      </motion.div>
    </div>
  );
}

/**
 * Gliding segmented tab control with shared layoutId spring indicator.
 */
export interface PillTabOption<T extends string> {
  id: T;
  label: React.ReactNode;
  activeTextClass?: string;
}

export function AlivePillTabs<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className,
}: {
  options: PillTabOption<T>[];
  value: T;
  onChange: (val: T) => void;
  layoutId: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100/90 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800',
        className
      )}
    >
      {options.map((tab) => {
        const active = value === tab.id;
        return (
          <motion.button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            whileTap={{ scale: 0.96 }}
            className={clsx(
              'relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none',
              active
                ? tab.activeTextClass || 'text-zinc-950 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING_SNAPPY}
                className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-800 shadow-xs border border-zinc-200/70 dark:border-white/10"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{tab.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * Staggered list item with organic rise + subtle hover lift.
 */
export function AliveListCard({
  index = 0,
  hoverLift = -2,
  className,
  children,
  ...rest
}: HTMLMotionProps<'div'> & {
  index?: number;
  hoverLift?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      whileHover={hoverLift ? { y: hoverLift } : undefined}
      transition={{
        opacity: { duration: 0.24, delay: Math.min(index * 0.04, 0.28), ease: EASE_FLUID },
        y: { type: 'spring', stiffness: 360, damping: 28, delay: Math.min(index * 0.035, 0.24) },
        scale: { duration: 0.22, ease: EASE_FLUID },
      }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Spring-animated glassmorphic modal overlay.
 */
export function AliveModal({
  isOpen,
  onClose,
  maxWidthClass = 'max-w-lg',
  className,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  maxWidthClass?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={SPRING_ORGANIC}
            className={clsx('relative z-10 w-full', maxWidthClass, className)}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

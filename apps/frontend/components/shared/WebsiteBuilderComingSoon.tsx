'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Globe, ArrowRight, FileText, Link as LinkIcon } from 'lucide-react';
import { SPRING_ORGANIC } from '@/components/ui/MotionPrimitives';

export function WebsiteBuilderComingSoon() {
  return (
    <div className="min-h-[72vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING_ORGANIC}
        className="relative overflow-hidden w-full max-w-md rounded-3xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-[0_0_40px_rgba(99,102,241,0.08)] p-8 text-center"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full bg-indigo-500/15 dark:bg-indigo-500/20 blur-3xl animate-td-breathe"
        />

        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold tracking-wider uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            Coming Soon
          </div>

          <motion.div
            whileHover={{ scale: 1.07, rotate: -3 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-[1px] shadow-md shadow-indigo-500/20"
          >
            <div className="w-full h-full rounded-[15px] bg-white dark:bg-zinc-950 flex items-center justify-center">
              <Globe className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
          </motion.div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Website Builder
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Launching soon — included automatically with your active plan.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2.5 pt-2 w-full">
            <Link
              href="/traffic-director/links"
              className="group flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-600/20 active:scale-95 transition-all"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Smart Links</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              href="/forms"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-white/10 text-xs font-bold active:scale-95 transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>180 Forms</span>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default WebsiteBuilderComingSoon;

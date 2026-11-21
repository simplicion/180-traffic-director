'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, ExternalLink, Trash2, MoreVertical, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ConfirmModal, DomainManagerModal } from '@workspace/ui';
import { EASE_FLUID, SPRING_SNAPPY } from '@/components/ui/MotionPrimitives';

interface WebsiteCardProps {
    website: any;
    companyData: any;
    onRefresh: () => void;
    index?: number;
}

function ThreeDotMenu({ websiteId, liveUrl, onOpenDomain, onDelete }: any) {
    const [open, setOpen] = useState(false);
    const ref = useRef<any>(null);

    useEffect(() => {
        const handler = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                className="p-2 bg-white rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 transition-colors shadow-xs"
                title="More Actions"
            >
                <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -4 }}
                        className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-gray-100 shadow-xl p-1.5 z-20"
                    >
                        <Link
                            href={`/advertising/${websiteId}/edit`}
                            onClick={() => setOpen(false)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                        >
                            <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                            <span>Edit Design</span>
                        </Link>
                        <button
                            onClick={() => { setOpen(false); onOpenDomain(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                        >
                            <Globe className="w-3.5 h-3.5 text-gray-400" />
                            <span>Domain Settings</span>
                        </button>
                        <a
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpen(false)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
                        >
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                            <span>Preview Live</span>
                        </a>
                        <div className="h-px bg-gray-100 my-1" />
                        <button
                            onClick={() => { setOpen(false); onDelete(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Website</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function WebsiteCard({ website, companyData, onRefresh, index = 0 }: WebsiteCardProps) {
    const router = useRouter();
    const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || '').trim();
    const liveUrl = website.customDomain
        ? `https://${website.customDomain}`
        : rootDomain
        ? `https://${website.slug}.${rootDomain}`
        : `/sites/${website.slug}`;
    
    const displayUrl = website.customDomain
        ? website.customDomain
        : rootDomain
        ? `${website.slug}.${rootDomain}`
        : `/sites/${website.slug}`;

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);

    const [timeRange, setTimeRange] = useState('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const calculateViews = () => {
        if (timeRange === 'all') return website.stats?.views ?? 0;
        
        const viewsByDate = website.stats?.viewsByDate || {};
        let total = 0;
        
        const now = new Date();
        const formatDate = (d: Date) => d.toISOString().slice(0, 10);
        const todayStr = formatDate(now);
        
        let startStr = '';
        if (timeRange === 'today') {
            startStr = todayStr;
        } else if (timeRange === 'week') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            startStr = formatDate(d);
        } else if (timeRange === 'month') {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            startStr = formatDate(d);
        }

        if (timeRange === 'custom') {
            if (!customStart || !customEnd) return 0;
            Object.keys(viewsByDate).forEach(dateStr => {
                if (dateStr >= customStart && dateStr <= customEnd) {
                    total += viewsByDate[dateStr];
                }
            });
            return total;
        }

        Object.keys(viewsByDate).forEach(dateStr => {
            if (dateStr >= startStr) {
                total += viewsByDate[dateStr];
            }
        });
        return total;
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        try {
            await api.delete(`/api/websites/${website.id}`);
            toast.success('Website deleted');
            setShowDeleteConfirm(false);
            onRefresh();
        } catch {
            toast.error('Failed to delete website');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ y: -2 }}
                transition={{
                    opacity: { duration: 0.24, delay: Math.min(index * 0.04, 0.28), ease: EASE_FLUID },
                    y: { type: 'spring', stiffness: 360, damping: 28, delay: Math.min(index * 0.035, 0.24) },
                }}
                onClick={() => router.push(`/advertising/${website.id}/edit`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/advertising/${website.id}/edit`);
                    }
                }}
                className="group bg-white/90 dark:bg-zinc-900/85 backdrop-blur-md rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 dark:hover:shadow-[0_0_30px_rgba(255,255,255,0.04)] hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-all flex flex-col justify-between p-5 gap-4 cursor-pointer select-none"
            >
                {/* Top Section: Logo & Status Badge + Website Name & URL */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        {website.config?.header?.logo ? (
                            <img src={website.config.header.logo} alt={website.name} className="w-10 h-10 rounded-xl object-contain border border-gray-100 p-1 bg-white shrink-0" />
                        ) : website.config?.brand?.primaryColor ? (
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0" style={{ backgroundColor: website.config.brand.primaryColor }}>
                                <Globe className="w-5 h-5 text-white" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                                <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
                            website.isPublished 
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60' 
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                        }`}>
                            {website.isPublished ? 'Published' : 'Draft'}
                        </span>
                    </div>

                    <div className="space-y-1">
                        <h3 className="font-bold text-zinc-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1 break-words">
                            {website.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            <a
                                href={liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-indigo-600 dark:hover:text-indigo-400 truncate flex items-center gap-1 font-mono text-[11px]"
                                title={liveUrl}
                            >
                                <span className="truncate">{displayUrl}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Middle: Total Visits count & Range Filter */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <select 
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 uppercase tracking-wider font-bold bg-transparent border-none p-0 cursor-pointer focus:ring-0 outline-none"
                        >
                            <option value="all">Total Visits</option>
                            <option value="today">Visits Today</option>
                            <option value="week">Visits Last Week</option>
                            <option value="month">Visits Last Month</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        <span className="text-base font-bold text-zinc-900 dark:text-white font-mono">
                            {calculateViews().toLocaleString()}
                        </span>
                    </div>

                    {timeRange === 'custom' && (
                        <div className="flex gap-1 items-center text-xs pt-1">
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-1/2 px-1 py-0.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded text-[10px] text-zinc-600 dark:text-zinc-300" />
                            <span className="text-zinc-400 text-[10px]">-</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-1/2 px-1 py-0.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded text-[10px] text-zinc-600 dark:text-zinc-300" />
                        </div>
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDomainModalOpen(true);
                            }}
                            title="Domain Settings"
                            className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all shadow-xs flex items-center justify-center cursor-pointer active:scale-95"
                        >
                            <Globe className="w-3.5 h-3.5" />
                        </button>
                        <a
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Preview Live"
                            className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-xs flex items-center justify-center active:scale-95"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Link
                            href={`/advertising/${website.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            title="Edit Website"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all shadow-xs active:scale-95"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </Link>
                        <ThreeDotMenu 
                            websiteId={website.id} 
                            liveUrl={liveUrl}
                            onOpenDomain={() => setIsDomainModalOpen(true)}
                            onDelete={() => setShowDeleteConfirm(true)} 
                        />
                    </div>
                </div>
            </motion.div>

            {/* Domain Manager Modal */}
            <DomainManagerModal 
                isOpen={isDomainModalOpen} 
                onClose={() => setIsDomainModalOpen(false)} 
                targetType="ADVERTISING_WEBSITE"
                targetId={website.id}
                targetName={website.name}
                initialDomain={website.customDomain || (website.slug ? `${website.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'localhost'}` : null)}
                onDomainSaved={() => onRefresh()}
                onDomainRemoved={() => onRefresh()}
            />

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                title="Delete Website"
                message={`Are you sure you want to delete "${website.name}"? All landing pages, assets, and analytics will be permanently removed.`}
                confirmText="Delete Website"
                cancelText="Cancel"
                loading={isDeleting}
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </>
    );
}

export { WebsiteCard };

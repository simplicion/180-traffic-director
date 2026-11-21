"use client";

import { LogoLoader, FeatureLock } from "@workspace/ui";
import { useState, useEffect, useRef } from 'react';
import { Plus, Globe, Search, Filter, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import WebsiteCard from "@/app/(platform)/(advertising-app)/_components/WebsiteCard";
import CreateWebsiteModal from "@/app/(platform)/(advertising-app)/_components/CreateWebsiteModal";
import { useSubscription } from '@/lib/useSubscription';
import { AliveProgressBar } from '@/components/ui/MotionPrimitives';

export default function AdvertisingPage() {
    return <AdvertisingPageContent />;
}

function AdvertisingPageContent() {
    const router = useRouter();
    const {
        hasApp,
        loading: subLoading,
        canCreateMoreWebsites,
        maxWebsites,
        isUnlimited,
        isTrialExpired,
        refresh: refreshSub,
    } = useSubscription();
    const isAppEnabled = hasApp('advertising') || hasApp('website-builder');

    const [websites, setWebsites] = useState<any[]>([]);
    const [companyData, setCompanyData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        if (isAppEnabled) {
            fetchWebsites();
        }
    }, [isAppEnabled]);

    // Fast In-Memory SWR Cache for 0ms Instant Navigation
    const swrCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

    const fetchWebsites = async () => {
        const cacheKey = 'advertising:websites:all';
        const cached = swrCacheRef.current.get(cacheKey);

        if (cached) {
            setWebsites(cached.data.websites || []);
            setCompanyData(cached.data.company || null);
            setLoading(false);
        } else {
            setLoading(true);
        }

        try {
            const res = await api.get('/api/websites');
            const fetchedWebsites = res.data?.websites || res.data?.data?.websites || [];
            const fetchedCompany = res.data?.company || res.data?.data?.company || null;
            setWebsites(fetchedWebsites);
            setCompanyData(fetchedCompany);
            swrCacheRef.current.set(cacheKey, {
                data: { websites: fetchedWebsites, company: fetchedCompany },
                timestamp: Date.now()
            });
        } catch (error: any) {
            if (!cached) {
                toast.error(error?.response?.data?.error || error?.message || 'Failed to load websites');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!subLoading && !isAppEnabled) {
        return (
            <div className="p-6">
                <FeatureLock
                    requiredApp="Website Builder"
                    title="Website Builder Locked"
                    description="The Website Builder app must be enabled on your workspace plan to create and manage custom marketing websites."
                />
            </div>
        );
    }

    const filteredWebsites = websites.filter(w =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const quotaLimit = isUnlimited ? 999999 : (maxWebsites ?? 1);
    const isLimitReached = !isUnlimited && websites.length >= quotaLimit;
    const canCreateWebsite = !isTrialExpired && !isLimitReached && canCreateMoreWebsites;
    const capacityUsedPercent = isUnlimited
        ? 0
        : Math.min(100, Math.round((websites.length / (quotaLimit || 1)) * 100));
    const publishedCount = websites.filter(w => w.isPublished).length;

    const handleOpenCreateModal = () => {
        if (isTrialExpired) {
            toast.error('Your 7-day free trial has expired. Upgrade your subscription to create new websites.');
            router.push('/traffic-director/subscription');
            return;
        }
        if (isLimitReached || !canCreateMoreWebsites) {
            toast.error(`Website quota limit reached (${websites.length}/${isUnlimited ? '∞' : quotaLimit}). Upgrade your plan to create more websites.`);
            router.push('/traffic-director/subscription');
            return;
        }
        setIsCreateModalOpen(true);
    };

    return (
        <div className="space-y-6 pb-16">
            <CreateWebsiteModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    fetchWebsites();
                    refreshSub();
                }}
                websiteCount={websites.length}
                companyData={companyData}
            />

            {/* Header & Integrated Capacity Controller */}
            <div className="p-6 rounded-2xl bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
                            Website Builder
                            <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2.5 py-0.5 rounded-full font-mono">
                                {websites.length}
                            </span>
                        </h1>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Manage your marketing websites, landing pages, custom domains, and track conversions.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleOpenCreateModal}
                            className={clsx(
                                "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer",
                                canCreateWebsite
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 active:scale-95"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-amber-400"
                            )}
                            title={canCreateWebsite ? 'Create a new Website' : 'Upgrade subscription to create more websites'}
                        >
                            {canCreateWebsite ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
                            <span>Create Website</span>
                            {!canCreateWebsite && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">
                                    Upgrade
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Websites Capacity Readout */}
                <div className="p-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-white/5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                Websites Capacity:
                            </span>
                            <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">
                                {websites.length}
                            </span>
                            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                                / {isUnlimited ? '∞ Unlimited' : `${quotaLimit} Allocated Space`}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400 flex-wrap">
                            <span>Published: <strong className="text-emerald-500 font-mono">{publishedCount}</strong></span>
                            <span>Drafts: <strong className="text-zinc-500 dark:text-zinc-300 font-mono">{Math.max(0, websites.length - publishedCount)}</strong></span>
                            {!isUnlimited && (
                                <span>
                                    Available Space: <strong className="text-indigo-500 font-mono">{Math.max(0, quotaLimit - websites.length)}</strong>
                                </span>
                            )}
                        </div>
                    </div>

                    {!isUnlimited && (
                        <>
                            <AliveProgressBar percent={capacityUsedPercent} />
                            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-0.5">
                                <span>{Math.max(0, quotaLimit - websites.length)} website {quotaLimit - websites.length === 1 ? 'slot' : 'slots'} available</span>
                                <Link
                                    href="/traffic-director/subscription"
                                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold inline-flex items-center gap-1"
                                >
                                    <span>Manage Plan & Quotas</span>
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search websites..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                    <Filter className="w-4 h-4" />
                    Filters
                </button>
            </div>

            {/* Websites Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <LogoLoader className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-4">Loading your websites...</p>
                </div>
            ) : filteredWebsites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredWebsites.map((website, idx) => (
                        <WebsiteCard
                            key={website.id}
                            index={idx}
                            website={website}
                            companyData={companyData}
                            onRefresh={() => {
                                fetchWebsites();
                                refreshSub();
                            }}
                        />
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900/80 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-zinc-50 dark:bg-zinc-800/80 flex items-center justify-center mx-auto mb-6">
                        <Globe className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">No websites found</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm mx-auto mb-8">
                        Create your first marketing website to start capturing leads for your campaigns.
                    </p>
                    <button
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                        onClick={handleOpenCreateModal}
                    >
                        {canCreateWebsite ? <Plus className="w-5 h-5" /> : <Lock className="w-4 h-4 text-amber-300" />}
                        <span>{canCreateWebsite ? 'Create My First Website' : 'Upgrade to Create Website'}</span>
                    </button>
                </div>
            )}
        </div>
    );
}

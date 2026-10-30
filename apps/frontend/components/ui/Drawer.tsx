import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DrawerProps {
    isOpen?: boolean;
    open?: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: string; // e.g. 'max-w-md', 'max-w-xl'
    size?: string;
    position?: string;
    icon?: React.ReactNode;
    description?: React.ReactNode;
    noPadding?: boolean;
}

export function Drawer({ 
    isOpen, 
    open, 
    onClose, 
    title, 
    children, 
    footer, 
    maxWidth = 'max-w-md',
    size,
    position = 'right',
    icon,
    description,
    noPadding = false
}: DrawerProps) {
    const [mounted, setMounted] = useState(false);
    const show = isOpen ?? open;
    const widthClass = size || maxWidth;
    const isLeft = position === 'left';

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [show]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && show) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [show, onClose]);

    const slideVariants = {
        hidden: { x: isLeft ? '-100%' : '100%' },
        visible: { x: 0 },
        exit: { x: isLeft ? '-100%' : '100%' }
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {show && (
                <div className={`fixed inset-0 z-[99999] flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                    <motion.div
                        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-[2px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        onClick={onClose}
                    />
                    <motion.div 
                        className={`relative bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md w-full ${widthClass} h-full shadow-2xl flex flex-col z-10 ${isLeft ? 'border-r' : 'border-l'} border-gray-200/80 dark:border-white/10`}
                        variants={slideVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="p-6 border-b border-gray-200/80 dark:border-white/10 flex items-start justify-between shrink-0 bg-white/50 dark:bg-zinc-900/50">
                            <div className="flex flex-col gap-1 min-w-0 pr-4">
                                <div className="flex items-center gap-3">
                                    {(() => {
                                        if (!icon) return null;
                                        if (React.isValidElement(icon)) return icon;
                                        if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null && 'render' in icon)) {
                                            const IconComp = icon as any;
                                            return <span className="text-gray-500 dark:text-gray-400"><IconComp className="w-5 h-5" /></span>;
                                        }
                                        return null;
                                    })()}
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{title}</h2>
                                </div>
                                {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
                            </div>
                            <button 
                                onClick={onClose} 
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer" 
                                title="Close"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className={`flex-1 min-h-0 overflow-y-auto ${noPadding ? '' : 'p-6 space-y-5'} custom-scrollbar`}>
                            {children}
                        </div>

                        {footer && (
                            <div className="p-5 border-t border-gray-200/80 dark:border-white/10 bg-gray-50/80 dark:bg-zinc-950/80 backdrop-blur-xs shrink-0">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}

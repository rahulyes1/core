'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ShareCard from '../ShareCard';

interface Note {
    id: string;
    title?: string;
    content: string;
    tags: string[];
    created_at: string;
    is_pinned: boolean;
    image_url?: string;
    mood?: string;
    expires_at?: string;
    locked_until?: string;
}

interface NoteCardProps {
    note: Note;
    onPin: () => void;
    onArchive: () => void;
    onDelete: () => void;
}

const tagColors: Record<string, string> = {
    work: 'text-[#2b6cee] bg-[#2b6cee]/10',
    roadmap: 'text-gray-500 bg-white/5',
    dev: 'text-purple-400 bg-purple-500/10',
    ideas: 'text-gray-500 bg-white/5',
    journal: 'text-green-400 bg-green-500/10',
    mindset: 'text-gray-500 bg-white/5',
    personal: 'text-orange-400 bg-orange-500/10',
    design: 'text-blue-400 bg-blue-500/10',
    reading: 'text-yellow-400 bg-yellow-500/10',
    product: 'text-pink-400 bg-pink-500/10',
};

function getTagColor(tag: string) {
    return tagColors[tag.toLowerCase()] ?? 'text-gray-400 bg-white/5';
}

function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
}

export default function NoteCard({ note, onPin, onArchive, onDelete }: NoteCardProps) {
    const router = useRouter();
    const controls = useAnimation();
    const [showActions, setShowActions] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPress = useRef(false);
    const didDrag = useRef(false);

    const title = note.title || note.content.replace(/<[^>]*>/g, '').split('\n')[0].slice(0, 40) || 'Untitled';
    const isLocked = note.locked_until && new Date(note.locked_until) > new Date();
    const preview = isLocked ? 'This note is locked until ' + new Date(note.locked_until!).toLocaleDateString()
        : note.content.replace(/<[^>]*>/g, '').slice(0, 120);

    const handleDragStart = () => {
        didDrag.current = true;
    };

    const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 80;
        if (info.offset.x > threshold) {
            onPin();
            await controls.start({ x: 400, opacity: 0, transition: { duration: 0.25 } });
        } else if (info.offset.x < -threshold) {
            onArchive();
            await controls.start({ x: -400, opacity: 0, transition: { duration: 0.25 } });
        } else {
            controls.start({ x: 0, transition: { type: 'spring', stiffness: 300 } });
        }
    };

    const handlePressStart = () => {
        didLongPress.current = false;
        didDrag.current = false;
        longPressTimer.current = setTimeout(() => {
            didLongPress.current = true;
            setShowActions(true);
        }, 500);
    };

    const handlePressEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        if (!didLongPress.current && !didDrag.current) {
            router.push(`/capture?id=${note.id}`);
        }
    };

    return (
        <>
            <motion.article
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={controls}
                onPointerDown={handlePressStart}
                onPointerUp={handlePressEnd}
                onPointerLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                className={`group flex flex-col h-full p-4 rounded-xl glass-card transition-all duration-300 cursor-pointer select-none aspect-[4/5] sm:aspect-square relative overflow-hidden ${note.image_url ? '' : ''}`}
                style={{ touchAction: 'pan-y' }}
            >
                {note.image_url && (
                    <div className="absolute inset-0 z-0">
                        <img src={note.image_url} alt="" className="w-full h-full object-cover opacity-50 transition-opacity group-hover:opacity-40" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/70 to-transparent" />
                    </div>
                )}

                <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full backdrop-blur-sm">{formatTime(note.created_at)}</span>
                            {note.mood && <span className="text-sm">{note.mood}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {note.locked_until && new Date(note.locked_until) > new Date() && (
                                <span className="material-symbols-outlined text-[14px] text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]">lock</span>
                            )}
                            {note.expires_at && new Date(note.expires_at) > new Date() && (
                                <span className="material-symbols-outlined text-[14px] text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]">local_fire_department</span>
                            )}
                            {note.is_pinned && (
                                <span className="material-symbols-outlined text-[14px] text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]">push_pin</span>
                            )}
                        </div>
                    </div>
                    <h3 className={`text-lg font-bold text-white leading-tight mb-2 line-clamp-2 ${isLocked ? 'blur-sm select-none' : 'group-hover:text-blue-400 transition-colors'}`}>{isLocked ? 'Locked Note' : title}</h3>
                    <p className={`text-sm text-gray-400 mb-auto line-clamp-3 leading-relaxed ${isLocked ? 'italic opacity-50' : ''}`}>{preview}</p>
                    <div className="flex gap-1.5 flex-wrap mt-4">
                        {note.tags.slice(0, 2).map(tag => (
                            <span key={tag} className={`text-[10px] px-2.5 py-1 rounded-full border border-white/5 ${getTagColor(tag)}`}>
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>


                {/* Actions (Always Visible) */}
                <div className="absolute top-3 right-3 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onPin(); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg transition-all hover:scale-110 ${note.is_pinned ? 'bg-blue-500 text-white' : 'bg-black/50 text-white/70 hover:bg-black/70 hover:text-white'}`}
                        title={note.is_pinned ? "Unpin" : "Pin"}
                    >
                        <span className="material-symbols-outlined text-[16px]">push_pin</span>
                    </button>
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 border border-white/10 backdrop-blur-md shadow-lg transition-all hover:scale-110"
                        title="Delete"
                    >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </div>
            </motion.article>

            {/* Action Sheet */}
            <AnimatePresence>
                {showActions && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                            onClick={() => setShowActions(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl p-4 pb-8"
                        >
                            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                            <p className="text-white font-semibold text-center mb-4 truncate px-4">{title}</p>

                            <div className="space-y-1">
                                <button
                                    onClick={() => { onPin(); setShowActions(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                                >
                                    <span className="material-symbols-outlined text-[22px] text-[#2b6cee]">push_pin</span>
                                    <span className="text-white font-medium">{note.is_pinned ? 'Unpin note' : 'Pin note'}</span>
                                </button>

                                <button
                                    onClick={() => { router.push(`/capture?id=${note.id}`); setShowActions(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                                >
                                    <span className="material-symbols-outlined text-[22px] text-gray-400">open_in_full</span>
                                    <span className="text-white font-medium">Open note</span>
                                </button>

                                <button
                                    onClick={() => { setShowShare(true); setShowActions(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                                >
                                    <span className="material-symbols-outlined text-[22px] text-pink-400">ios_share</span>
                                    <span className="text-white font-medium">Share as Image</span>
                                </button>

                                <button
                                    onClick={() => { onArchive(); setShowActions(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                                >
                                    <span className="material-symbols-outlined text-[22px] text-amber-400">archive</span>
                                    <span className="text-white font-medium">Archive</span>
                                </button>

                                <button
                                    onClick={() => { onDelete(); setShowActions(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-red-500/10 transition-colors text-left"
                                >
                                    <span className="material-symbols-outlined text-[22px] text-red-400">delete</span>
                                    <span className="text-red-400 font-medium">Delete note</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showShare && <ShareCard note={note} onClose={() => setShowShare(false)} />}
            </AnimatePresence>
        </>
    );
}

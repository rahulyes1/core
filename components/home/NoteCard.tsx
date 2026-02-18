'use client';

import { useState } from 'react';
import { motion, PanInfo, useAnimation } from 'framer-motion';

interface Note {
    id: string;
    title?: string;
    content: string;
    tags: string[];
    created_at: string;
    is_pinned: boolean;
    image_url?: string;
}

interface NoteCardProps {
    note: Note;
    onPin: () => void;
    onArchive: () => void;
}

// Tag color map
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

export default function NoteCard({ note, onPin, onArchive }: NoteCardProps) {
    const controls = useAnimation();

    const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 100;
        if (info.offset.x > threshold) {
            onPin();
            await controls.start({ x: 500, opacity: 0 });
        } else if (info.offset.x < -threshold) {
            onArchive();
            await controls.start({ x: -500, opacity: 0 });
        } else {
            controls.start({ x: 0 });
        }
    };

    const title = note.title || note.content.split('\n')[0].slice(0, 40) || 'Untitled';
    const preview = note.content.replace(/<[^>]*>/g, '').slice(0, 120);

    return (
        <motion.article
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            animate={controls}
            whileTap={{ scale: 0.98 }}
            className={`flex flex-col h-full p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors duration-150 aspect-[4/5] sm:aspect-square relative overflow-hidden ${note.image_url ? '' : 'bg-[#121212]'}`}
        >
            {/* Background image for notes with images */}
            {note.image_url && (
                <>
                    <div className="absolute inset-0 z-0">
                        <img
                            src={note.image_url}
                            alt=""
                            className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent" />
                    </div>
                </>
            )}

            <div className={`relative z-10 flex flex-col h-full ${note.image_url ? '' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-500 shrink-0">{formatTime(note.created_at)}</span>
                    {note.is_pinned && (
                        <span className="material-symbols-outlined text-[14px] text-[#2b6cee]">push_pin</span>
                    )}
                </div>

                <h3 className="text-base font-bold text-white leading-tight mb-2 line-clamp-2">{title}</h3>

                <p className="text-sm text-gray-400 mb-auto line-clamp-3 leading-relaxed">{preview}</p>

                <div className="flex gap-1.5 flex-wrap mt-3">
                    {note.tags.slice(0, 2).map(tag => (
                        <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-md ${getTagColor(tag)}`}>
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>
        </motion.article>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Note {
    id: string;
    title?: string;
    content: string;
    tags: string[];
    created_at: string;
    is_pinned: boolean;
}

export default function BookmarksPage() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPinned();
    }, []);

    const fetchPinned = async () => {
        const { data } = await supabase
            .from('notes')
            .select(`*, note_tags(tags(name))`)
            .eq('is_pinned', true)
            .eq('is_archived', false)
            .order('created_at', { ascending: false });

        if (data) {
            setNotes(data.map((n: any) => ({
                ...n,
                tags: n.note_tags?.map((nt: any) => nt.tags?.name).filter(Boolean) ?? []
            })));
        }
        setLoading(false);
    };

    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');

    const handleUnpin = async (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        await supabase.from('notes').update({ is_pinned: false }).eq('id', id);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 px-4 pt-14 pb-4">
                <h1 className="text-2xl font-bold text-white">Pinned Notes</h1>
                <p className="text-xs text-gray-600 mt-1">{notes.length} pinned</p>
            </div>

            <div className="flex-1 px-4 py-4 pb-24">
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-24 rounded-xl bg-[#121212] border border-white/5 animate-pulse" />
                        ))}
                    </div>
                ) : notes.length === 0 ? (
                    <div className="text-center pt-24">
                        <div className="w-20 h-20 bg-[#121212] border border-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-[36px] text-gray-700">push_pin</span>
                        </div>
                        <h3 className="text-white font-semibold mb-1">No pinned notes</h3>
                        <p className="text-gray-600 text-sm max-w-[200px] mx-auto">Long press any note and tap Pin to save it here</p>
                    </div>
                ) : (
                    <motion.div className="space-y-3">
                        {notes.map((note, i) => (
                            <motion.div
                                key={note.id}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.06 }}
                            >
                                <Link
                                    href={`/note/${note.id}`}
                                    className="flex items-start gap-3 p-4 rounded-xl bg-[#121212] border border-white/5 hover:border-[#2b6cee]/30 active:scale-[0.99] transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#2b6cee]/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="material-symbols-outlined text-[20px] text-[#2b6cee]">push_pin</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-[#2b6cee] transition-colors">
                                            {note.title || stripHtml(note.content).slice(0, 40)}
                                        </h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-1">
                                            {stripHtml(note.content).slice(0, 120)}
                                        </p>
                                        {note.tags.length > 0 && (
                                            <div className="flex gap-1.5 mt-2">
                                                {note.tags.slice(0, 3).map(tag => (
                                                    <span key={tag} className="text-[9px] text-[#2b6cee] bg-[#2b6cee]/10 px-1.5 py-0.5 rounded">#{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUnpin(note.id); }}
                                        className="p-1 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl px-4 pb-6 pt-3">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    {[
                        { href: '/', icon: 'home', active: false },
                        { href: '/search', icon: 'search', active: false },
                        { href: '/bookmarks', icon: 'bookmark', active: true },
                        { href: '/settings', icon: 'settings', active: false },
                    ].map(item => (
                        <Link key={item.href} href={item.href}
                            className={`flex flex-1 flex-col items-center justify-end gap-1 transition-colors ${item.active ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            <div className="flex h-7 items-center justify-center relative">
                                <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
                                {item.active && <span className="absolute -bottom-2 w-1 h-1 bg-[#2b6cee] rounded-full" />}
                            </div>
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}

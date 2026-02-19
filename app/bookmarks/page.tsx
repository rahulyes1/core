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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
            .from('notes')
            .select(`*, note_tags(tags(name))`)
            .eq('user_id', user.id)
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
            <div className="sticky top-0 z-50 glass-header px-4 pt-14 pb-4">
                <h1 className="text-2xl font-bold text-white tracking-tight">Pinned Notes</h1>
                <p className="text-xs text-gray-500 mt-1 font-medium">{notes.length} pinned</p>
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
                        <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                            <span className="material-symbols-outlined text-[36px] text-gray-600">push_pin</span>
                        </div>
                        <h3 className="text-white font-semibold mb-1">No pinned notes</h3>
                        <p className="text-gray-500 text-sm max-w-[200px] mx-auto">Long press any note and tap Pin to save it here</p>
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
                                    className="flex items-start gap-4 p-4 rounded-xl glass-panel hover:bg-white/5 active:scale-[0.99] transition-all group border border-white/5"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/20">
                                        <span className="material-symbols-outlined text-[20px] text-blue-400">push_pin</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
                                            {note.title || stripHtml(note.content).slice(0, 40)}
                                        </h3>
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mt-1">
                                            {stripHtml(note.content).slice(0, 120)}
                                        </p>
                                        {note.tags.length > 0 && (
                                            <div className="flex gap-1.5 mt-2">
                                                {note.tags.slice(0, 3).map(tag => (
                                                    <span key={tag} className="text-[9px] text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">#{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUnpin(note.id); }}
                                        className="p-2 -mr-2 text-gray-600 hover:text-red-400 transition-colors shrink-0"
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
            <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 glass-header px-6 pb-6 pt-4">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    {[
                        { href: '/', icon: 'home', active: false },
                        { href: '/search', icon: 'search', active: false },
                        { href: '/bookmarks', icon: 'bookmark', active: true },
                        { href: '/settings', icon: 'settings', active: false },
                    ].map(item => (
                        <Link key={item.href} href={item.href}
                            className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 ${item.active ? 'text-white scale-110' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <div className={`flex items-center justify-center relative rounded-xl p-1 ${item.active ? 'bg-white/10' : ''}`}>
                                <span className={`material-symbols-outlined text-[24px] ${item.active ? 'fill-current' : ''}`}>{item.icon}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}

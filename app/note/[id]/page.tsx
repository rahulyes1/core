'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/utils/supabase/client';
import { useParams, useRouter } from 'next/navigation';

// Bug 12 fix: sanitize HTML to prevent XSS
function sanitizeHtml(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
        .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
        .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
}

export default function NoteView() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const [note, setNote] = useState<any>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');

    useEffect(() => {
        if (!id) return;
        const fetchNote = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }

            const { data } = await supabase
                .from('notes')
                .select(`*, note_tags(tags(name))`)
                .eq('id', id)
                .eq('user_id', user.id)
                .single();
            if (data) setNote({ ...data, tags: data.note_tags?.map((nt: any) => nt.tags?.name).filter(Boolean) ?? [] });
            setLoading(false);
        };
        fetchNote();

        const channel = supabase
            .channel(`note-${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `id=eq.${id}` }, fetchNote)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id]);

    const handlePin = async () => {
        setActionLoading('pin');
        await supabase.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', id);
        setNote((prev: any) => ({ ...prev, is_pinned: !prev.is_pinned }));
        setActionLoading('');
        setShowMenu(false);
    };

    const handleArchive = async () => {
        setActionLoading('archive');
        await supabase.from('notes').update({ is_archived: true }).eq('id', id);
        router.replace('/');
    };

    const handleDelete = async () => {
        setActionLoading('delete');
        await supabase.from('notes').delete().eq('id', id);
        router.replace('/');
    };

    const formatDate = (str: string) => new Date(str).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
            <span className="material-symbols-outlined text-[32px] text-gray-600 animate-spin">progress_activity</span>
        </div>
    );

    if (!note) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-gray-500 gap-3">
            <span className="material-symbols-outlined text-[48px] opacity-30">note</span>
            <p>Note not found</p>
            <Link href="/" className="text-[#2b6cee] text-sm">← Back home</Link>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-50 border-b border-white/5">
                <Link href="/" className="p-1.5 -ml-1.5 rounded-full hover:bg-white/5 transition-colors">
                    <span className="material-symbols-outlined text-[24px] text-gray-400">arrow_back</span>
                </Link>

                <div className="flex items-center gap-2">
                    {/* Edit button (Bug 4 fix) */}
                    <Link href={`/capture?id=${id}`} className="p-1.5 rounded-full hover:bg-white/5 transition-colors">
                        <span className="material-symbols-outlined text-[24px] text-gray-400">edit</span>
                    </Link>

                    {/* Pin indicator */}
                    {note.is_pinned && (
                        <span className="material-symbols-outlined text-[18px] text-[#2b6cee]">push_pin</span>
                    )}

                    {/* Menu button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-1.5 -mr-1.5 rounded-full hover:bg-white/5 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[24px] text-gray-400">more_vert</span>
                        </button>

                        <AnimatePresence>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: -8 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -8 }}
                                        className="absolute right-0 top-10 w-48 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                                    >
                                        <button
                                            onClick={handlePin}
                                            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[20px] text-[#2b6cee]">push_pin</span>
                                            <span className="text-sm text-white">{note.is_pinned ? 'Unpin' : 'Pin note'}</span>
                                        </button>
                                        <button
                                            onClick={handleArchive}
                                            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-t border-white/5"
                                        >
                                            <span className="material-symbols-outlined text-[20px] text-amber-400">archive</span>
                                            <span className="text-sm text-white">Archive</span>
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 transition-colors border-t border-white/5"
                                        >
                                            <span className="material-symbols-outlined text-[20px] text-red-400">delete</span>
                                            <span className="text-sm text-red-400">Delete</span>
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-5 py-6 pb-32">
                {/* Date */}
                <p className="text-xs text-gray-600 mb-4">{formatDate(note.created_at)}</p>

                {/* Title */}
                {note.title && (
                    <h1 className="text-2xl font-bold text-white mb-4 leading-tight">{note.title}</h1>
                )}

                {/* AI Summary */}
                {note.summary && (
                    <div className="mb-6 p-4 bg-[#2b6cee]/5 rounded-xl border border-[#2b6cee]/20">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-[16px] text-[#2b6cee]">auto_awesome</span>
                            <h3 className="text-xs text-[#2b6cee] font-semibold uppercase tracking-wider">AI Summary</h3>
                        </div>
                        <p className="text-sm text-gray-300 italic leading-relaxed">{note.summary}</p>
                    </div>
                )}

                {/* Note content */}
                <div
                    className="prose prose-invert prose-base max-w-none text-gray-200 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content || '') }}
                />

                {/* Tags */}
                {note.tags?.length > 0 && (
                    <div className="mt-8 flex flex-wrap gap-2">
                        {note.tags.map((tag: string) => (
                            <span key={tag} className="px-3 py-1 rounded-full bg-[#2b6cee]/10 text-[#2b6cee] text-sm border border-[#2b6cee]/20">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom action bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/5 px-4 py-4 flex items-center justify-between">
                <p className="text-xs text-gray-600">
                    {note.updated_at ? `Edited ${new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePin}
                        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${note.is_pinned
                            ? 'border-[#2b6cee]/40 text-[#2b6cee] bg-[#2b6cee]/10'
                            : 'border-white/10 text-gray-400 hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px]">push_pin</span>
                        {note.is_pinned ? 'Pinned' : 'Pin'}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Delete
                    </button>
                </div>
            </div>
        </div >
    );
}

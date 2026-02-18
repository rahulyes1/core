'use client';

import { ArrowLeft, MoreVertical, Share, Trash2, Archive, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/utils/supabase/client';
import { useParams } from 'next/navigation';

export default function NoteView() {
    const params = useParams();
    const id = params?.id as string;
    const [note, setNote] = useState<any>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            const fetchNote = async () => {
                const { data, error } = await supabase
                    .from('notes')
                    .select(`
                    *,
                    note_tags (
                        tags (name)
                    )
                `)
                    .eq('id', id)
                    .single();

                if (data) {
                    setNote({
                        ...data,
                        tags: data.note_tags.map((nt: any) => nt.tags.name)
                    });
                }
                setLoading(false);
            };
            fetchNote();

            // Real-time subscription for this note
            const channel = supabase
                .channel(`note-${id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `id=eq.${id}` }, (payload) => {
                    // Refresh or update state
                    fetchNote();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            }
        }
    }, [id]);

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] text-neutral-500"><Loader2 className="animate-spin w-8 h-8" /></div>;
    if (!note) return <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] text-neutral-500">Note not found</div>;

    return (
        <div className="min-h-screen bg-[#0a0a0a] relative text-[#f0f0f0]">
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-50">
                <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-neutral-800 transition-colors">
                    <ArrowLeft className="w-6 h-6 text-neutral-400" />
                </Link>
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 -mr-2 rounded-full hover:bg-neutral-800 transition-colors"
                    >
                        <MoreVertical className="w-6 h-6 text-neutral-400" />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                className="absolute right-0 top-12 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50"
                            >
                                <button className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-neutral-800 text-neutral-300">
                                    <Share className="w-4 h-4" /> Share
                                </button>
                                <button className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-neutral-800 text-neutral-300">
                                    <Archive className="w-4 h-4" /> Archive
                                </button>
                                <button className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-neutral-800 text-red-400">
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Content Area */}
            <div className="px-6 py-4 pb-32">
                {note.summary && (
                    <div className="mb-6 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
                        <h3 className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-2">Summary</h3>
                        <p className="text-sm text-neutral-300 italic">{note.summary}</p>
                    </div>
                )}

                <div
                    className="prose prose-invert prose-lg max-w-none text-neutral-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: note.content }}
                />

                {/* AI Tags */}
                <div className="mt-8 flex flex-wrap gap-2">
                    {note.tags && note.tags.map((tag: string) => (
                        <span key={tag} className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium border border-blue-500/20">
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* Bottom Metadata */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0a0a] to-transparent text-center">
                <p className="text-xs text-neutral-600 font-medium">
                    Edited {new Date(note.updated_at).toLocaleTimeString()}
                </p>
            </div>
        </div>
    );
}

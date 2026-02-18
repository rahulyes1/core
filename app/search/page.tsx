'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Note {
    id: string;
    title?: string;
    content: string;
    tags: string[];
    created_at: string;
    is_pinned: boolean;
}

export default function SearchPage() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [recentSearches] = useState(['meeting', 'ideas', 'journal']);

    useEffect(() => {
        if (!query.trim()) { setResults([]); return; }
        const timer = setTimeout(() => search(query), 300);
        return () => clearTimeout(timer);
    }, [query]);

    const search = async (q: string) => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('notes')
                .select(`*, note_tags(tags(name))`)
                .or(`content.ilike.%${q}%,title.ilike.%${q}%`)
                .eq('is_archived', false)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                setResults(data.map((n: any) => ({
                    ...n,
                    tags: n.note_tags?.map((nt: any) => nt.tags?.name).filter(Boolean) ?? []
                })));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
            {/* Search Header */}
            <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 px-4 pt-12 pb-4">
                <div className="flex items-center gap-3 bg-[#1e1e1e] rounded-xl px-4 py-3 border border-white/5 focus-within:border-[#2b6cee]/40 transition-colors">
                    <span className="material-symbols-outlined text-gray-500 text-[22px]">search</span>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search your notes..."
                        autoFocus
                        className="flex-1 bg-transparent text-white text-base focus:outline-none placeholder:text-gray-600"
                    />
                    <AnimatePresence>
                        {query && (
                            <motion.button
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                onClick={() => setQuery('')}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex-1 px-4 py-4">
                {/* Empty state / suggestions */}
                {!query && (
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold mb-3">Recent</p>
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setQuery(s)}
                                        className="flex items-center gap-1.5 text-sm text-gray-400 bg-[#1e1e1e] border border-white/5 px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">history</span>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="text-center pt-16">
                            <span className="material-symbols-outlined text-[64px] text-gray-800 block mb-4">manage_search</span>
                            <p className="text-gray-600 text-sm">Search across all your notes</p>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center py-8">
                        <span className="material-symbols-outlined text-[24px] text-gray-600 animate-spin">progress_activity</span>
                    </div>
                )}

                {/* Results */}
                {query && !loading && (
                    <div className="space-y-1">
                        <p className="text-xs text-gray-600 mb-3">{results.length} result{results.length !== 1 ? 's' : ''}</p>

                        {results.length === 0 ? (
                            <div className="text-center py-16">
                                <span className="material-symbols-outlined text-[48px] text-gray-800 block mb-3">search_off</span>
                                <p className="text-gray-600 text-sm">No notes found for "{query}"</p>
                            </div>
                        ) : (
                            <motion.div className="space-y-2">
                                {results.map((note, i) => (
                                    <motion.div
                                        key={note.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                    >
                                        <Link
                                            href={`/note/${note.id}`}
                                            className="block p-4 rounded-xl bg-[#121212] border border-white/5 hover:border-white/10 active:scale-[0.99] transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <h3 className="text-sm font-bold text-white line-clamp-1">
                                                    {note.title || stripHtml(note.content).slice(0, 40)}
                                                </h3>
                                                <span className="text-[10px] text-gray-600 shrink-0 ml-2">
                                                    {new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                                {stripHtml(note.content).slice(0, 150)}
                                            </p>
                                            {note.tags.length > 0 && (
                                                <div className="flex gap-1.5 mt-2">
                                                    {note.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[9px] text-[#2b6cee] bg-[#2b6cee]/10 px-1.5 py-0.5 rounded">#{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </Link>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <BottomNav />
        </div>
    );
}

function BottomNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl px-4 pb-6 pt-3">
            <div className="flex items-center justify-between max-w-md mx-auto">
                {[
                    { href: '/', icon: 'home' },
                    { href: '/search', icon: 'search' },
                    { href: '/bookmarks', icon: 'bookmark' },
                    { href: '/settings', icon: 'settings' },
                ].map(item => (
                    <Link key={item.href} href={item.href}
                        className={`flex flex-1 flex-col items-center justify-end gap-1 transition-colors ${item.href === '/search' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                    >
                        <div className="flex h-7 items-center justify-center relative">
                            <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
                            {item.href === '/search' && <span className="absolute -bottom-2 w-1 h-1 bg-[#2b6cee] rounded-full" />}
                        </div>
                    </Link>
                ))}
            </div>
        </nav>
    );
}

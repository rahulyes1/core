'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NoteCard from './NoteCard';
import { supabase } from '@/utils/supabase/client';

interface Note {
    id: string;
    title?: string;
    content: string;
    tags: string[];
    created_at: string;
    is_pinned: boolean;
    image_url?: string;
}

const ALL_TAGS = ['All', '#product', '#ideas', '#personal', '#journal', '#work', '#dev'];

export default function NoteFeed() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTag, setActiveTag] = useState('All');

    useEffect(() => {
        fetchNotes();

        const channel = supabase
            .channel('realtime notes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
                fetchNotes();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchNotes = async () => {
        try {
            const { data, error } = await supabase
                .from('notes')
                .select(`*, note_tags(tags(name))`)
                .eq('is_archived', false)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedNotes = data.map((n: any) => ({
                ...n,
                tags: n.note_tags.map((nt: any) => nt.tags.name)
            }));

            setNotes(formattedNotes);
        } catch (error: any) {
            console.error('Error fetching notes:', error.message || error);
        } finally {
            setLoading(false);
        }
    };

    const handlePin = async (id: string, currentStatus: boolean) => {
        setNotes(prev =>
            prev.map(n => n.id === id ? { ...n, is_pinned: !currentStatus } : n)
                .sort((a, b) => (a.is_pinned === b.is_pinned) ? 0 : a.is_pinned ? -1 : 1)
        );
        await supabase.from('notes').update({ is_pinned: !currentStatus }).eq('id', id);
    };

    const handleArchive = async (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        await supabase.from('notes').update({ is_archived: true }).eq('id', id);
    };

    const filteredNotes = activeTag === 'All'
        ? notes
        : notes.filter(n => n.tags.some(t => `#${t}` === activeTag));

    return (
        <>
            {/* Main scrollable content */}
            <main className="flex-1 overflow-y-auto pb-24 pt-16">
                <div className="px-4 pb-6 space-y-6">

                    {/* Daily Digest Card */}
                    <div className="relative rounded-xl p-[1px] bg-gradient-to-br from-[#2b6cee]/60 via-purple-500/30 to-transparent">
                        <div className="bg-[#121212]/95 backdrop-blur-sm rounded-xl p-5 relative overflow-hidden group">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#2b6cee]/20 rounded-full blur-3xl group-hover:bg-[#2b6cee]/30 transition-all duration-700" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#2b6cee] text-[20px]">auto_awesome</span>
                                        <p className="text-xs font-semibold text-[#2b6cee] uppercase tracking-wider">Daily Digest</p>
                                    </div>
                                    <span className="text-xs text-gray-500">Today</span>
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2 leading-tight">Thematic Insight</h2>
                                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                                    You've written about <span className="text-white font-medium">building alone</span> 4 times this month. Consider reviewing these patterns to find new connections.
                                </p>
                                <button className="flex items-center gap-1 text-sm text-white font-medium hover:text-[#2b6cee] transition-colors group/btn">
                                    Review patterns
                                    <span className="material-symbols-outlined text-[16px] group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filter Chips */}
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                        {ALL_TAGS.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setActiveTag(tag)}
                                className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-all active:scale-95 ${activeTag === tag
                                        ? 'bg-white text-black font-semibold'
                                        : 'bg-[#1e1e1e] border border-white/5 text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                <p className="text-sm font-medium leading-normal">{tag}</p>
                            </button>
                        ))}
                    </div>

                    {/* Notes Grid */}
                    {loading ? (
                        <div className="grid grid-cols-2 gap-3">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="aspect-[4/5] rounded-xl bg-[#121212] border border-white/5 animate-pulse" />
                            ))}
                        </div>
                    ) : filteredNotes.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <span className="material-symbols-outlined text-[48px] mb-3 block">note_stack</span>
                            <p className="text-sm">No notes yet. Tap + to create one.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredNotes.map(note => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    onPin={() => handlePin(note.id, note.is_pinned)}
                                    onArchive={() => handleArchive(note.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Navigation */}
            <BottomNav />
        </>
    );
}

function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { href: '/', icon: 'home', label: 'Home' },
        { href: '/search', icon: 'search', label: 'Search' },
        { href: '/bookmarks', icon: 'bookmark', label: 'Saved' },
        { href: '/settings', icon: 'settings', label: 'Settings' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl px-4 pb-6 pt-3">
            <div className="flex items-center justify-between max-w-md mx-auto">
                {navItems.map(item => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-1 flex-col items-center justify-end gap-1 transition-colors ${isActive ? 'text-white' : 'text-gray-500 hover:text-white'
                                }`}
                        >
                            <div className="flex h-7 items-center justify-center relative">
                                <span className={`material-symbols-outlined text-[26px] ${isActive ? 'font-bold' : ''}`}>
                                    {item.icon}
                                </span>
                                {isActive && (
                                    <span className="absolute -bottom-2 w-1 h-1 bg-[#2b6cee] rounded-full" />
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

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
    mood?: string;
    expires_at?: string;
    locked_until?: string;
    image_url?: string;
}

const ALL_TAGS = ['All', '#product', '#ideas', '#personal', '#journal', '#work', '#dev'];

export default function NoteFeed() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTag, setActiveTag] = useState('All');
    const [onThisDayNotes, setOnThisDayNotes] = useState<Note[]>([]);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        fetchNotes();
        fetchOnThisDay();
        const channel = supabase
            .channel('realtime notes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => fetchNotes())
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
            const now = new Date();
            const formattedNotes = data.map((n: any) => ({
                ...n,
                tags: n.note_tags?.map((nt: any) => nt.tags?.name).filter(Boolean) ?? []
            })).filter((n: Note) => {
                // Filter expired ephemeral notes
                if (n.expires_at && new Date(n.expires_at) < now) return false;
                return true;
            });
            setNotes(formattedNotes);
            calculateStreak(formattedNotes);
        } catch (error: any) {
            console.error('Error fetching notes:', error.message || error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStreak = (notesList: Note[]) => {
        const dates = new Set(notesList.map(n => new Date(n.created_at).toDateString()));
        let count = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            if (dates.has(d.toDateString())) {
                count++;
            } else if (i > 0) {
                break;
            }
        }
        setStreak(count);
    };

    const fetchOnThisDay = async () => {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        try {
            const { data } = await supabase
                .from('notes')
                .select('*')
                .eq('is_archived', false)
                .not('created_at', 'gte', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                const matches = data.filter((n: any) => {
                    const d = new Date(n.created_at);
                    return d.getMonth() + 1 === month && d.getDate() === day && d.getFullYear() !== now.getFullYear();
                });
                setOnThisDayNotes(matches.map((n: any) => ({ ...n, tags: [] })));
            }
        } catch { }
    };

    const handlePin = async (id: string, currentStatus: boolean) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, is_pinned: !currentStatus } : n)
            .sort((a, b) => (a.is_pinned === b.is_pinned) ? 0 : a.is_pinned ? -1 : 1));
        await supabase.from('notes').update({ is_pinned: !currentStatus }).eq('id', id);
    };

    const handleArchive = async (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        await supabase.from('notes').update({ is_archived: true }).eq('id', id);
    };

    const handleDelete = async (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        await supabase.from('notes').delete().eq('id', id);
    };

    const filteredNotes = activeTag === 'All'
        ? notes
        : notes.filter(n => n.tags.some(t => `#${t}` === activeTag));

    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');

    return (
        <>
            <main className="flex-1 overflow-y-auto pb-24 pt-16">
                <div className="px-4 pb-6 space-y-5">

                    {/* Daily Digest + Streak */}
                    <div className="relative rounded-xl p-[1px] bg-gradient-to-br from-[#2b6cee]/60 via-purple-500/30 to-transparent">
                        <div className="bg-[#121212]/95 backdrop-blur-sm rounded-xl p-5 relative overflow-hidden group">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#2b6cee]/20 rounded-full blur-3xl group-hover:bg-[#2b6cee]/30 transition-all duration-700" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#2b6cee] text-[20px]">auto_awesome</span>
                                        <p className="text-xs font-semibold text-[#2b6cee] uppercase tracking-wider">Daily Digest</p>
                                    </div>
                                    {streak > 0 && (
                                        <div className="flex items-center gap-1 bg-orange-500/15 px-2.5 py-1 rounded-full">
                                            <span className="text-sm">🔥</span>
                                            <span className="text-xs font-bold text-orange-400">{streak} day{streak !== 1 && 's'}</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                                    {notes.length === 0 ? 'Start capturing thoughts' : `${notes.length} note${notes.length !== 1 ? 's' : ''} captured`}
                                </h2>
                                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                                    {notes.length === 0
                                        ? 'Tap the + button below to write your first note.'
                                        : streak > 1
                                            ? `You're on a ${streak}-day streak! Keep it going 🔥`
                                            : 'Keep the momentum going. Tap + to add a new thought.'}
                                </p>
                                <Link href="/capture" className="flex items-center gap-1 text-sm text-white font-medium hover:text-[#2b6cee] transition-colors group/btn">
                                    New note
                                    <span className="material-symbols-outlined text-[16px] group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* On This Day */}
                    {onThisDayNotes.length > 0 && (
                        <div className="rounded-xl bg-gradient-to-br from-purple-900/20 to-[#121212] border border-purple-500/10 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-purple-400 text-[20px]">history</span>
                                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">On This Day</p>
                            </div>
                            {onThisDayNotes.slice(0, 2).map(n => {
                                const year = new Date(n.created_at).getFullYear();
                                return (
                                    <Link key={n.id} href={`/capture?id=${n.id}`}
                                        className="flex items-center gap-3 py-2 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                                    >
                                        <span className="text-[11px] text-purple-300/50 font-mono w-8 shrink-0">{year}</span>
                                        <p className="text-sm text-gray-300 line-clamp-1">{stripHtml(n.content).slice(0, 80)}</p>
                                        {n.mood && <span className="text-sm">{n.mood}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* Filter Chips */}
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                        {ALL_TAGS.map(tag => (
                            <button key={tag} onClick={() => setActiveTag(tag)}
                                className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-all active:scale-95 text-sm font-medium ${activeTag === tag
                                        ? 'bg-white text-black font-semibold'
                                        : 'bg-[#1e1e1e] border border-white/5 text-gray-300 hover:bg-white/5'
                                    }`}
                            >{tag}</button>
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
                            <span className="material-symbols-outlined text-[48px] mb-3 block opacity-30">note_stack</span>
                            <p className="text-sm">No notes yet.</p>
                            <Link href="/capture" className="text-[#2b6cee] text-sm mt-2 inline-block">Write your first note →</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {filteredNotes.map(note => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    onPin={() => handlePin(note.id, note.is_pinned)}
                                    onArchive={() => handleArchive(note.id)}
                                    onDelete={() => handleDelete(note.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
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
                        <Link key={item.href} href={item.href}
                            className={`flex flex-1 flex-col items-center justify-end gap-1 transition-colors ${isActive ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            <div className="flex h-7 items-center justify-center relative">
                                <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
                                {isActive && <span className="absolute -bottom-2 w-1 h-1 bg-[#2b6cee] rounded-full" />}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

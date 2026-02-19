'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NoteCard from './NoteCard';
import SmartMergeCard from '../SmartMergeCard';
import TopBar from './TopBar';
import { supabase } from '@/utils/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';

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
    const [showMerge, setShowMerge] = useState(false);
    const [deletedNote, setDeletedNote] = useState<Note | null>(null);
    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetchNotes();
        fetchOnThisDay();
        const channel = supabase
            .channel('realtime notes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => fetchNotes())
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
            // Bug 7 fix: clean up undo timer on unmount
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        };
    }, []);

    const fetchNotes = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }

            const { data, error } = await supabase
                .from('notes')
                .select(`*, note_tags(tags(name))`)
                .eq('user_id', user.id)
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
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', user.id)
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
        const noteToDelete = notes.find(n => n.id === id);
        if (!noteToDelete) return;

        setDeletedNote(noteToDelete);
        setNotes(prev => prev.filter(n => n.id !== id));

        // Show undo toast for 4 seconds
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(async () => {
            await supabase.from('notes').delete().eq('id', id);
            setDeletedNote(null);
        }, 4000);
    };

    const handleUndo = async () => {
        if (!deletedNote) return;
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

        setNotes(prev => [deletedNote, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        setDeletedNote(null);
    };

    const handleTidyUp = () => {
        setShowMerge(true);
    };

    const filteredNotes = activeTag === 'All'
        ? notes
        : notes.filter(n => n.tags.some(t => `#${t}` === activeTag));

    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');

    return (
        <>
            <main className="flex-1 overflow-y-auto pb-24">
                <TopBar showTidyUp={notes.length >= 3} onTidyUp={handleTidyUp} />
                <div className="px-4 pb-6 space-y-5 pt-20">

                    {/* Daily Digest + Streak */}
                    <div className="relative">
                        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden group border border-white/10">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-[50px] group-hover:bg-blue-500/30 transition-all duration-700" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px]" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                                            <span className="material-symbols-outlined text-blue-400 text-[18px]">auto_awesome</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Daily Digest</p>
                                    </div>
                                    {streak > 0 && (
                                        <div className="flex items-center gap-1.5 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                                            <span className="text-sm">🔥</span>
                                            <span className="text-xs font-bold text-orange-400">{streak} day{streak !== 1 && 's'}</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2 leading-tight tracking-tight">
                                    {notes.length === 0 ? 'Start capturing thoughts' : `${notes.length} note${notes.length !== 1 ? 's' : ''} captured`}
                                </h2>
                                <p className="text-gray-400 text-sm leading-relaxed mb-5 max-w-[90%]">
                                    {notes.length === 0
                                        ? 'Tap the + button below to write your first note.'
                                        : streak > 1
                                            ? `You're on a ${streak}-day streak! Keep it going 🔥`
                                            : 'Keep the momentum going. Tap + to add a new thought.'}
                                </p>
                                <Link href="/capture" className="inline-flex items-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full transition-all shadow-lg shadow-blue-600/20 group/btn">
                                    New note
                                    <span className="material-symbols-outlined text-[16px] group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* On This Day */}
                    {onThisDayNotes.length > 0 && (
                        <div className="glass-panel rounded-2xl p-4 border border-purple-500/20 bg-purple-500/5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-purple-400 text-[20px]">history</span>
                                <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">On This Day</p>
                            </div>
                            <div className="space-y-2">
                                {onThisDayNotes.slice(0, 2).map(n => {
                                    const year = new Date(n.created_at).getFullYear();
                                    return (
                                        <Link key={n.id} href={`/capture?id=${n.id}`}
                                            className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors group"
                                        >
                                            <span className="text-[10px] text-purple-300/50 font-mono py-1 px-2 rounded-md bg-purple-500/10">{year}</span>
                                            <p className="text-sm text-gray-300 line-clamp-1 group-hover:text-white transition-colors">{stripHtml(n.content).slice(0, 80)}</p>
                                            {n.mood && <span className="text-sm ml-auto">{n.mood}</span>}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Smart Merge */}
                    {(showMerge || notes.length >= 3) && (
                        <div className={!showMerge ? 'hidden' : ''}>
                            <SmartMergeCard key="smart-merge" notes={notes} onMerge={() => { fetchNotes(); setShowMerge(false); }} />
                        </div>
                    )}

                    {/* Filter Chips */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {ALL_TAGS.map(tag => (
                            <button key={tag} onClick={() => setActiveTag(tag)}
                                className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-all active:scale-95 text-xs font-medium border ${activeTag === tag
                                    ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
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

            {/* Undo Toast */}
            <AnimatePresence>
                {deletedNote && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-24 left-4 right-4 z-50 flex items-center justify-between glass-panel rounded-xl p-4 shadow-xl border border-white/10"
                    >
                        <span className="text-sm text-white font-medium">Note deleted</span>
                        <button onClick={handleUndo} className="text-sm font-bold text-blue-400 hover:text-blue-300">
                            Undo
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

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
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 glass-header px-6 pb-6 pt-4">
            <div className="flex items-center justify-between max-w-md mx-auto">
                {navItems.map(item => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href}
                            className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isActive ? 'text-white scale-110' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <div className={`flex items-center justify-center relative rounded-xl p-1 ${isActive ? 'bg-white/10' : ''}`}>
                                <span className={`material-symbols-outlined text-[24px] ${isActive ? 'fill-current' : ''}`}>{item.icon}</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}


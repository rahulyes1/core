'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Note {
    id: string;
    title?: string;
    content: string;
}

interface SmartMergeCardProps {
    notes: Note[];
    onMerge: () => void;
}

export default function SmartMergeCard({ notes, onMerge }: SmartMergeCardProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [suggestion, setSuggestion] = useState<any>(null);

    const handleAnalyze = async () => {
        if (analyzing) return;
        setAnalyzing(true);
        try {
            // Pick top 10 recent notes
            const recentNotes = notes.slice(0, 10).map(n => ({
                id: n.id,
                title: n.title || 'Untitled',
                content: n.content.replace(/<[^>]*>/g, '').slice(0, 200)
            }));

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'merge', notes: recentNotes })
            });

            const data = await response.json();
            if (data.shouldMerge && data.noteIds?.length > 1) {
                setSuggestion(data);
            } else {
                // Show "No merge needed" briefly or just nothing
                setSuggestion({ shouldMerge: false, message: 'All organized! No merges needed.' });
                setTimeout(() => setSuggestion(null), 3000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

    const executeMerge = async () => {
        if (!suggestion || !suggestion.shouldMerge) return;
        setAnalyzing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Create new merged note
            const { error } = await supabase.from('notes').insert({
                user_id: user.id,
                title: suggestion.mergedTitle,
                content: `<p>${suggestion.mergedContent.replace(/\n/g, '<br>')}</p>`,
                updated_at: new Date().toISOString(),
            });

            if (error) throw error;

            // Delete old notes
            await supabase.from('notes').delete().in('id', suggestion.noteIds);

            // Refresh
            onMerge();
            setSuggestion(null);
        } catch (e) {
            console.error(e);
            alert('Merge failed');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="mb-6">
            {!suggestion && (
                <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1e1e1e] border border-white/5 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50"
                >
                    {analyzing ? (
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    ) : (
                        <span className="material-symbols-outlined text-[18px]">cleaning_services</span>
                    )}
                    {analyzing ? 'Analyzing notes...' : 'Tidy Up'}
                </button>
            )}

            <AnimatePresence>
                {suggestion && suggestion.shouldMerge && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-[#2b6cee]/20 to-purple-900/20 border border-[#2b6cee]/30">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-[#2b6cee]">auto_awesome</span>
                                <span className="text-sm font-bold text-white">Merge Suggestion</span>
                            </div>
                            <p className="text-xs text-gray-300 mb-3">
                                Found {suggestion.noteIds?.length} similar notes. Merge them into:
                            </p>
                            <div className="bg-[#121212]/50 rounded-lg p-3 mb-3 border border-white/5">
                                <h4 className="text-sm font-bold text-white mb-1">{suggestion.mergedTitle}</h4>
                                <p className="text-xs text-gray-400 line-clamp-2">{suggestion.mergedContent}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSuggestion(null)}
                                    className="flex-1 py-2 rounded-lg bg-white/5 text-xs text-gray-400 hover:bg-white/10"
                                >
                                    Ignore
                                </button>
                                <button
                                    onClick={executeMerge}
                                    disabled={analyzing}
                                    className="flex-1 py-2 rounded-lg bg-[#2b6cee] text-xs text-white font-semibold hover:bg-[#2b6cee]/80"
                                >
                                    {analyzing ? 'Merging...' : 'Merge Notes'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {suggestion && !suggestion.shouldMerge && suggestion.message && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 text-center text-xs text-green-400 flex items-center justify-center gap-1"
                    >
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        {suggestion.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

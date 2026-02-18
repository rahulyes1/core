'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas-pro';

interface ShareCardProps {
    note: {
        title?: string;
        content: string;
        mood?: string;
        tags: string[];
        created_at: string;
    };
    onClose: () => void;
}

export default function ShareCard({ note, onClose }: ShareCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [generating, setGenerating] = useState(false);

    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '');
    const title = note.title || stripHtml(note.content).slice(0, 40);
    const body = stripHtml(note.content).slice(0, 280);
    const date = new Date(note.created_at).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric', year: 'numeric'
    });

    const handleShare = async () => {
        if (!cardRef.current) return;
        setGenerating(true);
        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: null,
                scale: 3,
                useCORS: true,
            });
            const blob = await new Promise<Blob>((resolve) =>
                canvas.toBlob((b) => resolve(b!), 'image/png')
            );

            if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'note.png', { type: 'image/png' })] })) {
                await navigator.share({
                    files: [new File([blob], 'note.png', { type: 'image/png' })],
                    title: title,
                });
            } else {
                // Fallback: download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `note-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={onClose} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a] rounded-t-3xl p-5 pb-10 max-h-[85vh] overflow-y-auto"
            >
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
                <p className="text-sm text-white font-semibold text-center mb-4">Share as Image</p>

                {/* The Card to capture */}
                <div ref={cardRef} className="mx-auto max-w-[340px] rounded-2xl overflow-hidden"
                    style={{ background: 'linear-gradient(145deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)' }}
                >
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#2b6cee] to-purple-600 flex items-center justify-center text-white font-bold text-[8px]">C</div>
                                <span style={{ color: '#6b7280', fontSize: '11px' }}>Core Notes</span>
                            </div>
                            {note.mood && <span style={{ fontSize: '20px' }}>{note.mood}</span>}
                        </div>

                        {/* Title */}
                        <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, lineHeight: 1.3, marginBottom: '12px' }}>
                            {title}
                        </h2>

                        {/* Body */}
                        <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.7, marginBottom: '16px' }}>
                            {body}{body.length >= 280 ? '...' : ''}
                        </p>

                        {/* Tags */}
                        {note.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
                                {note.tags.slice(0, 4).map(tag => (
                                    <span key={tag} style={{
                                        fontSize: '11px', color: '#60a5fa', backgroundColor: 'rgba(43,108,238,0.15)',
                                        padding: '2px 8px', borderRadius: '4px'
                                    }}>#{tag}</span>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                            <span style={{ color: '#4b5563', fontSize: '11px' }}>{date}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-5 max-w-[340px] mx-auto">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-medium text-sm"
                    >Cancel</button>
                    <button onClick={handleShare} disabled={generating}
                        className="flex-1 py-3 rounded-xl bg-[#2b6cee] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {generating ? (
                            <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Generating</>
                        ) : (
                            <><span className="material-symbols-outlined text-[18px]">share</span>Share</>
                        )}
                    </button>
                </div>
            </motion.div>
        </>
    );
}

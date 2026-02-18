'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAI } from '@/hooks/useAI';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function CapturePage() {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [noteId, setNoteId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const { result: aiResult, loading: aiLoading } = useAI(content);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const contentRef = useRef('');
    const titleRef = useRef('');

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: "What's on your mind...",
                emptyEditorClass: 'is-editor-empty before:text-neutral-600 before:content-[attr(data-placeholder)] before:float-left before:h-0 before:pointer-events-none',
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-base max-w-none focus:outline-none min-h-[60vh] px-4 py-2',
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            setContent(html);
            contentRef.current = html;
            // Auto-save after 2.5s of inactivity
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                if (contentRef.current && contentRef.current !== '<p></p>') {
                    performSave(contentRef.current, titleRef.current);
                }
            }, 2500);
        },
    });

    const performSave = useCallback(async (htmlContent: string, noteTitle: string) => {
        if (!htmlContent || htmlContent === '<p></p>') return;
        setSaveStatus('saving');
        setErrorMsg('');

        try {
            // Get current user
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                setErrorMsg('Not signed in');
                setSaveStatus('error');
                return;
            }

            // Build upsert payload — no title column if it doesn't exist yet
            const payload: any = {
                content: htmlContent,
                user_id: user.id,
                updated_at: new Date().toISOString(),
            };

            // Only add id if updating existing note
            if (noteId) payload.id = noteId;

            // Try with title first, fall back without if column missing
            let noteData: any = null;
            let saveError: any = null;

            const withTitle = await supabase
                .from('notes')
                .upsert({ ...payload, title: noteTitle || null })
                .select()
                .single();

            if (withTitle.error?.message?.includes('title')) {
                // title column doesn't exist yet, save without it
                const withoutTitle = await supabase
                    .from('notes')
                    .upsert(payload)
                    .select()
                    .single();
                noteData = withoutTitle.data;
                saveError = withoutTitle.error;
            } else {
                noteData = withTitle.data;
                saveError = withTitle.error;
            }

            if (saveError) {
                console.error('Save error:', saveError);
                setErrorMsg(saveError.message);
                setSaveStatus('error');
                return;
            }

            if (noteData) {
                setNoteId(noteData.id);

                // Handle AI tags
                if (aiResult?.tags?.length) {
                    for (const tagName of aiResult.tags) {
                        try {
                            const { data: existingTag } = await supabase
                                .from('tags').select('id').eq('name', tagName).single();
                            let tagId = existingTag?.id;
                            if (!tagId) {
                                const { data: newTag } = await supabase
                                    .from('tags').insert({ name: tagName }).select().single();
                                tagId = newTag?.id;
                            }
                            if (tagId) {
                                await supabase.from('note_tags').upsert({
                                    note_id: noteData.id,
                                    tag_id: tagId
                                });
                            }
                        } catch (tagErr) {
                            console.warn('Tag error (non-fatal):', tagErr);
                        }
                    }
                }
            }

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2500);
        } catch (e: any) {
            console.error('Unexpected save error:', e);
            setErrorMsg(e?.message || 'Unknown error');
            setSaveStatus('error');
        }
    }, [noteId, aiResult]);

    const handleManualSave = () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        performSave(contentRef.current || content, titleRef.current || title);
    };

    const handleBack = async () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (content && content !== '<p></p>' && saveStatus !== 'saved') {
            await performSave(contentRef.current || content, titleRef.current || title);
        }
        router.push('/');
    };

    const wordCount = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;
    const hasContent = content && content !== '<p></p>';

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col text-white">

            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-50 border-b border-white/5">
                <button onClick={handleBack} className="p-1.5 -ml-1.5 rounded-full hover:bg-white/5 transition-colors">
                    <span className="material-symbols-outlined text-[24px] text-gray-400">arrow_back</span>
                </button>

                <div className="flex items-center gap-3">
                    {/* Save status text */}
                    <AnimatePresence mode="wait">
                        {saveStatus !== 'idle' && (
                            <motion.span
                                key={saveStatus}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`text-xs font-medium ${saveStatus === 'saving' ? 'text-gray-500' :
                                        saveStatus === 'saved' ? 'text-green-400' :
                                            'text-red-400'
                                    }`}
                            >
                                {saveStatus === 'saving' && '● Saving...'}
                                {saveStatus === 'saved' && '✓ Saved'}
                                {saveStatus === 'error' && `✕ ${errorMsg || 'Error'}`}
                            </motion.span>
                        )}
                    </AnimatePresence>

                    {/* AI indicator */}
                    {aiLoading && (
                        <span className="text-xs text-[#2b6cee] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            AI
                        </span>
                    )}
                </div>
            </div>

            {/* Title Input */}
            <input
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); titleRef.current = e.target.value; }}
                placeholder="Title (optional)"
                className="w-full bg-transparent text-white text-2xl font-bold px-4 pt-5 pb-2 focus:outline-none placeholder:text-gray-700"
            />

            {/* Editor */}
            <div className="flex-1">
                <EditorContent editor={editor} />
            </div>

            {/* AI Tags */}
            {aiResult?.tags && aiResult.tags.length > 0 && (
                <div className="px-4 py-2 flex gap-2 flex-wrap border-t border-white/5">
                    <span className="text-xs text-gray-600">AI:</span>
                    {aiResult.tags.map(tag => (
                        <span key={tag} className="text-xs text-[#2b6cee] bg-[#2b6cee]/10 px-2 py-0.5 rounded-md">
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Bottom word count bar */}
            <div className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/5 px-4 py-3 pb-6">
                <span className="text-xs text-gray-600">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            </div>

            {/* Floating Save Button — bottom right */}
            <AnimatePresence>
                {hasContent && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleManualSave}
                        disabled={saveStatus === 'saving'}
                        className={`fixed bottom-20 right-5 z-50 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg font-semibold text-sm transition-all ${saveStatus === 'saved'
                                ? 'bg-green-500 text-white shadow-green-500/20'
                                : saveStatus === 'error'
                                    ? 'bg-red-500 text-white shadow-red-500/20'
                                    : 'bg-[#2b6cee] text-white shadow-[#2b6cee]/30'
                            } disabled:opacity-60`}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {saveStatus === 'saving' ? 'progress_activity' :
                                saveStatus === 'saved' ? 'check_circle' :
                                    saveStatus === 'error' ? 'error' : 'save'}
                        </span>
                        {saveStatus === 'saving' ? 'Saving...' :
                            saveStatus === 'saved' ? 'Saved!' :
                                saveStatus === 'error' ? 'Retry' : 'Save'}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from 'next/link';
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAI } from '@/hooks/useAI';
import { useRouter } from 'next/navigation';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function CapturePage() {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [noteId, setNoteId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const { result: aiResult, loading: aiLoading } = useAI(content);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                class: 'prose prose-invert prose-base max-w-none focus:outline-none min-h-[50vh] px-4 py-2',
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            setContent(html);
            // Auto-save after 2s of inactivity
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                if (html && html !== '<p></p>') performSave(html, title);
            }, 2000);
        },
    });

    const performSave = useCallback(async (htmlContent: string, noteTitle: string) => {
        if (!htmlContent || htmlContent === '<p></p>') return;
        setSaveStatus('saving');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setSaveStatus('error'); return; }

            const { data: noteData, error } = await supabase.from('notes').upsert({
                id: noteId || undefined,
                content: htmlContent,
                title: noteTitle || null,
                user_id: user.id,
                updated_at: new Date().toISOString(),
                summary: aiResult?.summary || null,
            }).select().single();

            if (error) throw error;

            if (noteData) {
                setNoteId(noteData.id);
                // Handle AI tags
                if (aiResult?.tags?.length) {
                    for (const tagName of aiResult.tags) {
                        const { data: existingTag } = await supabase.from('tags').select('id').eq('name', tagName).single();
                        let tagId = existingTag?.id;
                        if (!tagId) {
                            const { data: newTag } = await supabase.from('tags').insert({ name: tagName }).select().single();
                            tagId = newTag?.id;
                        }
                        if (tagId) {
                            await supabase.from('note_tags').upsert({ note_id: noteData.id, tag_id: tagId });
                        }
                    }
                }
            }
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
            console.error(e);
            setSaveStatus('error');
        }
    }, [noteId, aiResult]);

    const handleManualSave = () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        performSave(content, title);
    };

    const handleSaveAndExit = async () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        await performSave(content, title);
        router.push('/');
    };

    const wordCount = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col text-white">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-50 border-b border-white/5">
                <button
                    onClick={handleSaveAndExit}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>

                <div className="flex items-center gap-3">
                    {/* Save status */}
                    <span className={`text-xs transition-all ${saveStatus === 'saving' ? 'text-gray-500' :
                            saveStatus === 'saved' ? 'text-green-400' :
                                saveStatus === 'error' ? 'text-red-400' : 'text-transparent'
                        }`}>
                        {saveStatus === 'saving' && '● Saving...'}
                        {saveStatus === 'saved' && '✓ Saved'}
                        {saveStatus === 'error' && '✕ Error'}
                    </span>

                    {/* AI loading */}
                    {aiLoading && (
                        <span className="text-xs text-[#2b6cee] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            AI
                        </span>
                    )}

                    {/* Manual save button */}
                    <button
                        onClick={handleManualSave}
                        disabled={saveStatus === 'saving' || !content || content === '<p></p>'}
                        className="bg-[#2b6cee] text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-[#2b6cee]/80 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Title Input */}
            <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full bg-transparent text-white text-2xl font-bold px-4 pt-5 pb-2 focus:outline-none placeholder:text-gray-700"
            />

            {/* Editor */}
            <div className="flex-1 px-0">
                <EditorContent editor={editor} />
            </div>

            {/* AI Tags */}
            {aiResult?.tags && aiResult.tags.length > 0 && (
                <div className="px-4 py-2 flex gap-2 flex-wrap border-t border-white/5">
                    <span className="text-xs text-gray-600">AI tags:</span>
                    {aiResult.tags.map(tag => (
                        <span key={tag} className="text-xs text-[#2b6cee] bg-[#2b6cee]/10 px-2 py-0.5 rounded-md">
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Bottom bar — word count + done */}
            <div className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/5 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-600">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                <button
                    onClick={handleSaveAndExit}
                    className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                    Done
                    <span className="material-symbols-outlined text-[18px]">check</span>
                </button>
            </div>
        </div>
    );
}

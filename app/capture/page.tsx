'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useState, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAI } from '@/hooks/useAI';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

type NoteType = 'note' | 'todo';

export default function CapturePage() {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [noteType, setNoteType] = useState<NoteType>('note');
    const [saving, setSaving] = useState(false);
    const { result: aiResult, loading: aiLoading } = useAI(content);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({
                placeholder: noteType === 'todo' ? 'Add your tasks...' : "What's on your mind...",
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
            setContent(editor.getHTML());
        },
    });

    const insertTodo = () => {
        if (!editor) return;
        editor.chain().focus().toggleTaskList().run();
        setNoteType('todo');
    };

    const ensureUserProfile = async (user: any) => {
        // Make sure user exists in public.users (for foreign key)
        await supabase.from('users').upsert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
        }, { onConflict: 'id' });
    };

    const handleSave = async () => {
        if (!content || content === '<p></p>') return;
        setSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }

            // Ensure profile exists
            await ensureUserProfile(user);

            const payload: any = {
                content,
                user_id: user.id,
                updated_at: new Date().toISOString(),
            };

            // Try with title
            try {
                const { error } = await supabase.from('notes').insert({
                    ...payload,
                    title: title || null,
                });
                if (error && error.message?.includes('title')) {
                    // title column missing, save without
                    await supabase.from('notes').insert(payload);
                } else if (error) {
                    throw error;
                }
            } catch (e) {
                throw e;
            }

            // Handle AI tags
            if (aiResult?.tags?.length) {
                const { data: latestNote } = await supabase
                    .from('notes')
                    .select('id')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (latestNote) {
                    for (const tagName of aiResult.tags) {
                        try {
                            let { data: existing } = await supabase.from('tags').select('id').eq('name', tagName).single();
                            let tagId = existing?.id;
                            if (!tagId) {
                                const { data: newTag } = await supabase.from('tags').insert({ name: tagName }).select().single();
                                tagId = newTag?.id;
                            }
                            if (tagId) {
                                await supabase.from('note_tags').upsert({ note_id: latestNote.id, tag_id: tagId });
                            }
                        } catch { }
                    }
                }
            }

            // Instant redirect home
            router.push('/');

        } catch (e: any) {
            console.error('Save failed:', e);
            setSaving(false);
            alert('Save failed: ' + (e?.message || 'Unknown error'));
        }
    };

    const handleBack = () => {
        router.push('/');
    };

    const wordCount = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;
    const hasContent = content && content !== '<p></p>';

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col text-white">

            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-50 border-b border-white/5">
                <button onClick={handleBack} className="p-1.5 -ml-1.5 rounded-full hover:bg-white/5 transition-colors">
                    <span className="material-symbols-outlined text-[24px] text-gray-400">close</span>
                </button>

                <div className="flex items-center gap-2">
                    {aiLoading && (
                        <span className="text-xs text-[#2b6cee] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            AI
                        </span>
                    )}
                </div>
            </div>

            {/* Note Type Switcher */}
            <div className="flex gap-2 px-4 pt-4">
                <button
                    onClick={() => setNoteType('note')}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${noteType === 'note'
                            ? 'bg-white text-black'
                            : 'bg-[#1e1e1e] text-gray-400 border border-white/5'
                        }`}
                >
                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                    Note
                </button>
                <button
                    onClick={() => { setNoteType('todo'); insertTodo(); }}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${noteType === 'todo'
                            ? 'bg-white text-black'
                            : 'bg-[#1e1e1e] text-gray-400 border border-white/5'
                        }`}
                >
                    <span className="material-symbols-outlined text-[14px]">checklist</span>
                    To-Do
                </button>
            </div>

            {/* Title Input */}
            <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={noteType === 'todo' ? 'Task list name...' : 'Title (optional)'}
                className="w-full bg-transparent text-white text-2xl font-bold px-4 pt-4 pb-2 focus:outline-none placeholder:text-gray-700"
            />

            {/* Editor */}
            <div className="flex-1">
                <EditorContent editor={editor} />
            </div>

            {/* Formatting toolbar */}
            {editor && (
                <div className="sticky bottom-16 z-30 px-4 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">format_bold</span>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">format_italic</span>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={`p-2 rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">strikethrough_s</span>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-2 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`p-2 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        className={`p-2 rounded-lg transition-colors ${editor.isActive('taskList') ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">check_box</span>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`p-2 rounded-lg transition-colors ${editor.isActive('heading') ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">title</span>
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={`p-2 rounded-lg transition-colors ${editor.isActive('blockquote') ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">format_quote</span>
                    </button>
                </div>
            )}

            {/* Bottom bar */}
            <div className="sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/5 px-4 py-3 pb-6 flex items-center justify-between">
                <span className="text-xs text-gray-600">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                {aiResult?.tags && (
                    <div className="flex gap-1.5">
                        {aiResult.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] text-[#2b6cee] bg-[#2b6cee]/10 px-1.5 py-0.5 rounded">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Save Button — bottom right */}
            <AnimatePresence>
                {hasContent && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleSave}
                        disabled={saving}
                        className="fixed bottom-20 right-5 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full bg-[#2b6cee] text-white shadow-lg shadow-[#2b6cee]/30 font-semibold text-sm active:bg-[#2b6cee]/80 transition-colors disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                Saving...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[20px]">check</span>
                                Save
                            </>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

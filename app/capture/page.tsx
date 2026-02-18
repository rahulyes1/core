'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAI } from '@/hooks/useAI';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function CapturePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-gray-600 animate-spin">progress_activity</span>
            </div>
        }>
            <CaptureContent />
        </Suspense>
    );
}

type NoteType = 'note' | 'todo';

function CaptureContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');

    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [noteType, setNoteType] = useState<NoteType>('note');
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(!editId); // if new note, already loaded
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

    // Load existing note for editing
    useEffect(() => {
        if (!editId || !editor) return;

        const loadNote = async () => {
            const { data } = await supabase
                .from('notes')
                .select('*')
                .eq('id', editId)
                .single();

            if (data) {
                setTitle(data.title || '');
                editor.commands.setContent(data.content || '');
                setContent(data.content || '');

                // Detect if it has task list items
                if (data.content?.includes('data-type="taskList"')) {
                    setNoteType('todo');
                }

                // Move cursor to end
                setTimeout(() => {
                    editor.commands.focus('end');
                }, 100);
            }
            setLoaded(true);
        };

        loadNote();
    }, [editId, editor]);

    const insertTodo = () => {
        if (!editor) return;
        editor.chain().focus().toggleTaskList().run();
        setNoteType('todo');
    };

    const ensureUserProfile = async (user: any) => {
        await supabase.from('users').upsert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
        }, { onConflict: 'id' });
    };

    const handleOk = async () => {
        if (!content || content === '<p></p>') {
            router.push('/');
            return;
        }
        setSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }

            await ensureUserProfile(user);

            const payload: any = {
                content,
                user_id: user.id,
                updated_at: new Date().toISOString(),
            };

            if (editId) {
                // Update existing note
                try {
                    await supabase.from('notes').update({
                        ...payload,
                        title: title || null,
                    }).eq('id', editId);
                } catch {
                    await supabase.from('notes').update(payload).eq('id', editId);
                }
            } else {
                // Insert new note
                try {
                    const { error } = await supabase.from('notes').insert({
                        ...payload,
                        title: title || null,
                    });
                    if (error && error.message?.includes('title')) {
                        await supabase.from('notes').insert(payload);
                    } else if (error) {
                        throw error;
                    }
                } catch (e) {
                    throw e;
                }
            }

            // Handle AI tags for new notes
            if (!editId && aiResult?.tags?.length) {
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
            alert('Failed: ' + (e?.message || 'Unknown error'));
        }
    };

    const handleBack = () => {
        router.push('/');
    };

    const wordCount = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;
    const hasContent = content && content !== '<p></p>';

    // Loading state for edit mode
    if (!loaded) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-gray-600 animate-spin">progress_activity</span>
            </div>
        );
    }

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
                    {editId && (
                        <span className="text-xs text-gray-600">Editing</span>
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
                    {[
                        { action: () => editor.chain().focus().toggleBold().run(), icon: 'format_bold', check: 'bold' },
                        { action: () => editor.chain().focus().toggleItalic().run(), icon: 'format_italic', check: 'italic' },
                        { action: () => editor.chain().focus().toggleStrike().run(), icon: 'strikethrough_s', check: 'strike' },
                        { action: () => editor.chain().focus().toggleBulletList().run(), icon: 'format_list_bulleted', check: 'bulletList' },
                        { action: () => editor.chain().focus().toggleOrderedList().run(), icon: 'format_list_numbered', check: 'orderedList' },
                        { action: () => editor.chain().focus().toggleTaskList().run(), icon: 'check_box', check: 'taskList' },
                        { action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), icon: 'title', check: 'heading' },
                        { action: () => editor.chain().focus().toggleBlockquote().run(), icon: 'format_quote', check: 'blockquote' },
                    ].map(btn => (
                        <button
                            key={btn.icon}
                            onClick={btn.action}
                            className={`p-2 rounded-lg transition-colors ${editor.isActive(btn.check) ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{btn.icon}</span>
                        </button>
                    ))}
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

            {/* Floating OK Button — bottom right */}
            <AnimatePresence>
                {hasContent && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleOk}
                        disabled={saving}
                        className="fixed bottom-20 right-5 z-50 w-14 h-14 rounded-full bg-[#2b6cee] text-white shadow-lg shadow-[#2b6cee]/30 flex items-center justify-center active:bg-[#2b6cee]/80 transition-colors disabled:opacity-50"
                    >
                        {saving ? (
                            <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-[28px]">check</span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

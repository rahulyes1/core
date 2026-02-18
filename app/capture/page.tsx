'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useState, useEffect, Suspense, useRef } from 'react';
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

const MOODS = ['😊', '🔥', '💡', '😤', '😔', '😴'];
const EPHEMERAL_OPTIONS = [
    { label: 'Off', value: null },
    { label: '24h', value: 24 },
    { label: '7d', value: 168 },
];

function CaptureContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');

    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [noteType, setNoteType] = useState<NoteType>('note');
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(!editId);
    const [mood, setMood] = useState<string | null>(null);
    const [ephemeralHours, setEphemeralHours] = useState<number | null>(null);
    const [showEphemeral, setShowEphemeral] = useState(false);
    const [lockedUntil, setLockedUntil] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [linkQuery, setLinkQuery] = useState<string | null>(null);
    const [linkResults, setLinkResults] = useState<{ id: string, title: string }[]>([]);
    const [linkRange, setLinkRange] = useState<{ from: number, to: number } | null>(null);
    const recognitionRef = useRef<any>(null);
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
                class: 'prose prose-invert prose-base max-w-none focus:outline-none min-h-[50vh] px-4 py-2',
            },
        },
        onUpdate: ({ editor }) => {
            setContent(editor.getHTML());
            // Link detection
            const { state } = editor;
            const { selection } = state;
            const { $from } = selection;
            const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - 20), $from.parentOffset, '\n', '\uFFFC');
            const match = textBefore.match(/\[\[([^\]]*)$/);

            if (match) {
                const query = match[1];
                setLinkQuery(query);
                setLinkRange({ from: $from.pos - query.length - 2, to: $from.pos });
            } else {
                setLinkQuery(null);
                setLinkRange(null);
            }
        },
    });

    // Fetch link suggestions
    useEffect(() => {
        if (linkQuery === null) { setLinkResults([]); return; }
        const fetchLinks = async () => {
            const { data } = await supabase
                .from('notes')
                .select('id, title, content')
                .or(`title.ilike.%${linkQuery}%,content.ilike.%${linkQuery}%`)
                .limit(5);

            if (data) {
                setLinkResults(data.map((n: any) => ({
                    id: n.id,
                    title: n.title || n.content.replace(/<[^>]*>/g, '').slice(0, 20) || 'Untitled'
                })));
            }
        };
        const timer = setTimeout(fetchLinks, 300);
        return () => clearTimeout(timer);
    }, [linkQuery]);

    const insertLink = (note: { id: string, title: string }) => {
        if (!editor || !linkRange) return;
        editor
            .chain()
            .focus()
            .deleteRange(linkRange)
            .setMark('textStyle', { color: '#2b6cee' })
            .insertContent(`<a href="/capture?id=${note.id}" style="color: #2b6cee; text-decoration: none; background: rgba(43, 108, 238, 0.1); padding: 0 4px; border-radius: 4px;">@${note.title}</a> `)
            .unsetMark('textStyle')
            .run();
        setLinkQuery(null);
    };

    // Load existing note
    useEffect(() => {
        if (!editId || !editor) return;
        const loadNote = async () => {
            const { data } = await supabase.from('notes').select('*').eq('id', editId).single();
            if (data) {
                setTitle(data.title || '');
                setMood(data.mood || null);
                editor.commands.setContent(data.content || '');
                setContent(data.content || '');
                if (data.content?.includes('data-type="taskList"')) setNoteType('todo');
                setTimeout(() => editor.commands.focus('end'), 100);
            }
            setLoaded(true);
        };
        loadNote();
    }, [editId, editor]);

    // Voice-to-Note
    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('Speech not supported in this browser'); return; }
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (e: any) => {
            let transcript = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                transcript += e.results[i][0].transcript;
            }
            if (e.results[e.resultIndex].isFinal && editor) {
                editor.chain().focus('end').insertContent(transcript + ' ').run();
            }
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        recognitionRef.current = recognition;
        setIsListening(true);
    };

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
        if (!content || content === '<p></p>') { router.push('/'); return; }
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }
            await ensureUserProfile(user);

            const payload: any = {
                content,
                user_id: user.id,
                updated_at: new Date().toISOString(),
                mood: mood || null,
            };

            // Add ephemeral expiry
            if (ephemeralHours) {
                payload.expires_at = new Date(Date.now() + ephemeralHours * 60 * 60 * 1000).toISOString();
            }

            // Add time capsule lock
            if (lockedUntil) {
                payload.locked_until = lockedUntil;
            }

            if (editId) {
                await supabase.from('notes').update({ ...payload, title: title || null }).eq('id', editId);
            } else {
                const { error } = await supabase.from('notes').insert({ ...payload, title: title || null });
                if (error && error.message?.includes('mood')) {
                    // columns missing, save minimal
                    const { error: e2 } = await supabase.from('notes').insert({
                        content, user_id: user.id, updated_at: new Date().toISOString(),
                    });
                    if (e2) throw e2;
                } else if (error) throw error;
            }

            // AI tags
            if (!editId && aiResult?.tags?.length) {
                const { data: latestNote } = await supabase.from('notes').select('id')
                    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
                if (latestNote) {
                    for (const tagName of aiResult.tags) {
                        try {
                            let { data: existing } = await supabase.from('tags').select('id').eq('name', tagName).single();
                            let tagId = existing?.id;
                            if (!tagId) {
                                const { data: newTag } = await supabase.from('tags').insert({ name: tagName }).select().single();
                                tagId = newTag?.id;
                            }
                            if (tagId) await supabase.from('note_tags').upsert({ note_id: latestNote.id, tag_id: tagId });
                        } catch { }
                    }
                }
            }
            router.push('/');
        } catch (e: any) {
            console.error('Save failed:', e);
            setSaving(false);
            alert('Failed: ' + (e?.message || 'Unknown error'));
        }
    };

    const wordCount = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;
    const hasContent = content && content !== '<p></p>';

    if (!loaded) return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-gray-600 animate-spin">progress_activity</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col text-white">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-50 border-b border-white/5">
                <button onClick={() => router.push('/')} className="p-1.5 -ml-1.5 rounded-full hover:bg-white/5 transition-colors">
                    <span className="material-symbols-outlined text-[24px] text-gray-400">close</span>
                </button>
                <div className="flex items-center gap-2">
                    {aiLoading && (
                        <span className="text-xs text-[#2b6cee] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>AI
                        </span>
                    )}
                    {editId && <span className="text-xs text-gray-600">Editing</span>}
                    {isListening && (
                        <span className="text-xs text-red-400 flex items-center gap-1 animate-pulse">
                            <span className="w-2 h-2 bg-red-400 rounded-full" />Listening...
                        </span>
                    )}
                </div>
            </div>

            {/* Type Switcher + Ephemeral + Time Capsule */}
            <div className="flex gap-2 px-4 pt-4 flex-wrap">
                <button onClick={() => setNoteType('note')}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${noteType === 'note' ? 'bg-white text-black' : 'bg-[#1e1e1e] text-gray-400 border border-white/5'}`}
                >
                    <span className="material-symbols-outlined text-[14px]">edit_note</span>Note
                </button>
                <button onClick={() => { setNoteType('todo'); insertTodo(); }}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${noteType === 'todo' ? 'bg-white text-black' : 'bg-[#1e1e1e] text-gray-400 border border-white/5'}`}
                >
                    <span className="material-symbols-outlined text-[14px]">checklist</span>To-Do
                </button>
                <button onClick={() => setShowEphemeral(!showEphemeral)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${ephemeralHours ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-[#1e1e1e] text-gray-400 border border-white/5'}`}
                >
                    <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                    {ephemeralHours ? (ephemeralHours === 24 ? '24h' : '7d') : 'Ephemeral'}
                </button>
                <div className="relative">
                    <button onClick={() => {
                        const el = document.getElementById('capsule-date');
                        if (el) (el as HTMLInputElement).showPicker();
                    }}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${lockedUntil ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-[#1e1e1e] text-gray-400 border border-white/5'}`}
                    >
                        <span className="material-symbols-outlined text-[14px]">lock_clock</span>
                        {lockedUntil ? `Until ${new Date(lockedUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Time Capsule'}
                    </button>
                    <input id="capsule-date" type="date" className="absolute inset-0 opacity-0 w-full cursor-pointer"
                        min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                        onChange={e => setLockedUntil(e.target.value ? new Date(e.target.value).toISOString() : null)}
                    />
                </div>
            </div>

            {/* Ephemeral Options */}
            <AnimatePresence>
                {showEphemeral && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="flex gap-2 px-4 pt-2">
                            {EPHEMERAL_OPTIONS.map(opt => (
                                <button key={opt.label} onClick={() => { setEphemeralHours(opt.value); setShowEphemeral(false); }}
                                    className={`text-xs px-3 py-1.5 rounded-full transition-all ${ephemeralHours === opt.value ? 'bg-orange-500 text-white' : 'bg-[#1e1e1e] text-gray-400 border border-white/5'}`}
                                >{opt.label}</button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Title */}
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder={noteType === 'todo' ? 'Task list name...' : 'Title (optional)'}
                className="w-full bg-transparent text-white text-2xl font-bold px-4 pt-4 pb-2 focus:outline-none placeholder:text-gray-700"
            />

            {/* Editor */}
            <div className="flex-1"><EditorContent editor={editor} /></div>

            {/* Mood Picker */}
            <div className="px-4 py-2 border-t border-white/5">
                <p className="text-[10px] text-gray-600 mb-1.5">How are you feeling?</p>
                <div className="flex gap-2">
                    {MOODS.map(m => (
                        <button key={m} onClick={() => setMood(mood === m ? null : m)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${mood === m ? 'bg-white/10 scale-110 ring-2 ring-[#2b6cee]' : 'hover:bg-white/5 active:scale-95'}`}
                        >{m}</button>
                    ))}
                </div>
            </div>

            {/* Link Autocomplete Dropdown */}
            <AnimatePresence>
                {linkQuery !== null && linkResults.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-20 left-4 right-4 z-40 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto"
                    >
                        <p className="text-[10px] text-gray-500 px-3 py-2 border-b border-white/5 bg-[#121212]">Link to note</p>
                        {linkResults.map(note => (
                            <button key={note.id} onClick={() => insertLink(note)}
                                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-gray-500 text-[16px]">description</span>
                                <span className="text-sm text-gray-200 truncate">{note.title}</span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

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
                        <button key={btn.icon} onClick={btn.action}
                            className={`p-2 rounded-lg transition-colors ${editor.isActive(btn.check) ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                        ><span className="material-symbols-outlined text-[18px]">{btn.icon}</span></button>
                    ))}
                    {/* Mic button */}
                    <button onClick={toggleVoice}
                        className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    ><span className="material-symbols-outlined text-[18px]">mic</span></button>
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

            {/* Floating OK Button */}
            <AnimatePresence>
                {hasContent && (
                    <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} whileTap={{ scale: 0.9 }}
                        onClick={handleOk} disabled={saving}
                        className="fixed bottom-20 right-5 z-50 w-14 h-14 rounded-full bg-[#2b6cee] text-white shadow-lg shadow-[#2b6cee]/30 flex items-center justify-center disabled:opacity-50"
                    >
                        {saving ? <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
                            : <span className="material-symbols-outlined text-[28px]">check</span>}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

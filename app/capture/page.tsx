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
            <div style={{ height: '100vh', background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined text-[32px] text-gray-600 animate-spin">progress_activity</span>
            </div>
        }>
            <CaptureContent />
        </Suspense>
    );
}

const NOTE_TYPES = [
    { id: 'note', label: 'Note', icon: '✏️' },
    { id: 'todo', label: 'To-Do', icon: '☑️' },
    { id: 'ephemeral', label: 'Ephemeral', icon: '🔥' },
    { id: 'capsule', label: 'Time Capsule', icon: '🔒' },
] as const;

type NoteTypeId = 'note' | 'todo' | 'ephemeral' | 'capsule';

const EPHEMERAL_OPTIONS = [
    { label: '24h', value: 24 },
    { label: '7d', value: 168 },
];

const styles = {
    bg: '#0a0a0c',
    surface: '#131316',
    surfaceHover: '#1a1a1f',
    border: 'rgba(255,255,255,0.06)',
    borderActive: 'rgba(129,140,248,0.3)',
    text: '#ededef',
    textMuted: '#6b6b76',
    textDim: '#45454f',
    accent: '#818cf8',
    accentBg: 'rgba(129,140,248,0.1)',
    accentGlow: 'rgba(99,102,241,0.25)',
};

function CaptureContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');

    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [noteType, setNoteType] = useState<NoteTypeId>('note');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(!editId);
    const [mood, setMood] = useState<string | null>(null);
    const [ephemeralHours, setEphemeralHours] = useState<number | null>(null);
    const [showEphemeralPicker, setShowEphemeralPicker] = useState(false);
    const [lockedUntil, setLockedUntil] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [linkQuery, setLinkQuery] = useState<string | null>(null);
    const [linkResults, setLinkResults] = useState<{ id: string, title: string }[]>([]);
    const [linkRange, setLinkRange] = useState<{ from: number, to: number } | null>(null);
    const [showOptions, setShowOptions] = useState(false);
    const [activeFormat, setActiveFormat] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const { result: aiResult, loading: aiLoading } = useAI(content);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({
                placeholder: noteType === 'todo' ? 'Add your tasks...' : "Start writing...",
                emptyEditorClass: 'is-editor-empty',
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-[40vh]',
                style: 'font-family: "DM Sans", sans-serif; font-weight: 300; font-size: 15px; line-height: 1.8; color: #c4c4cc; letter-spacing: 0.01em;',
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
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('notes')
                .select('id, title, content')
                .eq('user_id', user.id)
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
            .insertContent(`<a href="/capture?id=${note.id}" style="color: #818cf8; text-decoration: none; background: rgba(129,140,248,0.1); padding: 0 4px; border-radius: 4px;">@${note.title}</a> `)
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

    const handleNoteTypeChange = (typeId: NoteTypeId) => {
        setNoteType(typeId);
        if (typeId === 'todo' && editor && !editor.isActive('taskList')) {
            editor.chain().focus().toggleTaskList().run();
        }
        if (typeId === 'ephemeral') {
            setShowEphemeralPicker(true);
        } else {
            setShowEphemeralPicker(false);
        }
        if (typeId === 'capsule') {
            const el = document.getElementById('capsule-date');
            if (el) (el as HTMLInputElement).showPicker();
        }
    };

    const ensureUserProfile = async (user: any) => {
        await supabase.from('users').upsert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
        }, { onConflict: 'id' });
    };

    const handleSave = async () => {
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

            if (ephemeralHours) {
                payload.expires_at = new Date(Date.now() + ephemeralHours * 60 * 60 * 1000).toISOString();
            }
            if (lockedUntil) {
                payload.locked_until = lockedUntil;
            }

            if (editId) {
                await supabase.from('notes').update({ ...payload, title: title || null }).eq('id', editId);
            } else {
                const { error } = await supabase.from('notes').insert({ ...payload, title: title || null });
                if (error && error.message?.includes('mood')) {
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

            setSaved(true);
            setTimeout(() => router.push('/'), 400);
        } catch (e: any) {
            console.error('Save failed:', e);
            setSaving(false);
            alert('Failed: ' + (e?.message || 'Unknown error'));
        }
    };

    const wordCount = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length;

    const autoResize = (el: HTMLTextAreaElement | null) => {
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    };

    useEffect(() => {
        autoResize(titleRef.current);
    }, [title]);

    if (!loaded) return (
        <div style={{ height: '100vh', background: styles.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined text-[32px] text-gray-600 animate-spin">progress_activity</span>
        </div>
    );

    const isActiveType = (id: string) => {
        if (id === 'note' && noteType === 'note') return true;
        if (id === 'todo' && noteType === 'todo') return true;
        if (id === 'ephemeral' && ephemeralHours) return true;
        if (id === 'capsule' && lockedUntil) return true;
        return false;
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500&display=swap');
                
                @keyframes checkPop { 
                    0% { transform: scale(1); } 
                    50% { transform: scale(1.2); } 
                    100% { transform: scale(1); } 
                }
                
                .type-chip { transition: all 0.2s ease; }
                .type-chip:hover { background: ${styles.surfaceHover} !important; }
                .type-chip.active { background: ${styles.accentBg} !important; border-color: ${styles.borderActive} !important; }
                .type-chip.active .chip-label { color: ${styles.accent} !important; }
                .type-chip.active .chip-icon { transform: scale(1.1); }
                
                .fmt-btn { transition: all 0.15s ease; position: relative; }
                .fmt-btn:hover { background: ${styles.surfaceHover} !important; color: ${styles.text} !important; }
                .fmt-btn:active { transform: scale(0.94); }
                .fmt-btn.active { color: ${styles.accent} !important; background: ${styles.accentBg} !important; }
                
                .save-btn:active { transform: scale(0.95); }
                
                .scroll-area::-webkit-scrollbar { width: 0; }
                .scroll-area { scrollbar-width: none; -ms-overflow-style: none; }

                .capture-editor .ProseMirror { min-height: 40vh; outline: none; }
                .capture-editor .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: ${styles.textDim};
                    pointer-events: none;
                    height: 0;
                    font-family: 'DM Sans', sans-serif;
                    font-weight: 300;
                }
                .capture-editor .ProseMirror ul[data-type="taskList"] { list-style: none; padding: 0; }
                .capture-editor .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
                .capture-editor .ProseMirror ul[data-type="taskList"] li label { margin-top: 2px; }
                .capture-editor .ProseMirror ul { padding-left: 1.2em; }
                .capture-editor .ProseMirror ol { padding-left: 1.2em;}
                .capture-editor .ProseMirror blockquote { border-left: 3px solid ${styles.accent}; padding-left: 12px; margin-left: 0; color: ${styles.textMuted}; }
                .capture-editor .ProseMirror h1, .capture-editor .ProseMirror h2, .capture-editor .ProseMirror h3 { color: ${styles.text}; font-family: 'Newsreader', Georgia, serif; font-weight: 500; }
                .capture-editor .ProseMirror strong { color: ${styles.text}; }
            `}</style>

            <div style={{
                height: '100vh',
                width: '100%',
                maxWidth: 640,
                margin: '0 auto',
                background: styles.bg,
                fontFamily: "'DM Sans', sans-serif",
                color: styles.text,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
            }}>

                {/* ═══════════════════════════════════════════ */}
                {/* ZONE 1: Top Navigation                      */}
                {/* ═══════════════════════════════════════════ */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px 10px',
                    flexShrink: 0,
                }}>
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: styles.textMuted,
                            fontSize: 22,
                            cursor: 'pointer',
                            padding: '4px 8px 4px 0',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        ←
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* AI processing indicator */}
                        {aiLoading && (
                            <span style={{
                                fontSize: 11,
                                color: styles.accent,
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                background: styles.accentBg,
                                padding: '3px 10px',
                                borderRadius: 20,
                                border: `1px solid ${styles.borderActive}`,
                            }}>
                                <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                                AI
                            </span>
                        )}

                        {/* Recording indicator */}
                        {isListening && (
                            <span style={{
                                fontSize: 11,
                                color: '#f87171',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'rgba(248,113,113,0.1)',
                                padding: '3px 10px',
                                borderRadius: 20,
                                border: '1px solid rgba(248,113,113,0.2)',
                                animation: 'softPulse 1.5s infinite',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171' }} />
                                Rec
                            </span>
                        )}

                        {/* Editing badge */}
                        {editId && (
                            <span style={{
                                fontSize: 10,
                                color: styles.textDim,
                                fontWeight: 600,
                                textTransform: 'uppercase' as const,
                                letterSpacing: '0.05em',
                                background: 'rgba(255,255,255,0.04)',
                                padding: '3px 8px',
                                borderRadius: 20,
                            }}>Editing</span>
                        )}

                        {/* Word count */}
                        <div style={{
                            fontSize: 11,
                            color: styles.textDim,
                            fontWeight: 500,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase' as const,
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {wordCount} words
                        </div>

                        {/* AI tag dots */}
                        {aiResult?.tags && aiResult.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: 3 }}>
                                {aiResult.tags.slice(0, 3).map((tag: string) => (
                                    <div key={tag} title={`#${tag}`} style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: styles.accent, opacity: 0.5,
                                    }} />
                                ))}
                            </div>
                        )}

                        {/* Options */}
                        <button
                            onClick={() => setShowOptions(!showOptions)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: styles.textMuted,
                                fontSize: 18,
                                cursor: 'pointer',
                                padding: '4px',
                                letterSpacing: 2,
                            }}
                        >
                            •••
                        </button>
                    </div>
                </div>

                {/* Options dropdown (mood picker) */}
                <AnimatePresence>
                    {showOptions && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden', flexShrink: 0 }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 18px 12px',
                                borderBottom: `1px solid ${styles.border}`,
                            }}>
                                <span style={{ fontSize: 12, color: styles.textMuted, fontWeight: 500 }}>Mood</span>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {['😊', '🔥', '💡', '😤', '😔', '😴'].map(m => (
                                        <button key={m}
                                            onClick={() => setMood(mood === m ? null : m)}
                                            style={{
                                                width: 34, height: 34, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 18, cursor: 'pointer', border: 'none',
                                                background: mood === m ? 'rgba(255,255,255,0.12)' : 'transparent',
                                                filter: mood === m ? 'none' : 'grayscale(0.6)',
                                                opacity: mood === m ? 1 : 0.6,
                                                transition: 'all 0.2s ease',
                                                transform: mood === m ? 'scale(1.1)' : 'scale(1)',
                                            }}
                                        >{m}</button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══════════════════════════════════════════ */}
                {/* ZONE 2: Note Type Selector                  */}
                {/* ═══════════════════════════════════════════ */}
                <div style={{ padding: '4px 18px 12px', flexShrink: 0 }}>
                    <div style={{
                        display: 'flex',
                        gap: 8,
                        overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch',
                    }} className="scroll-area">
                        {NOTE_TYPES.map((type) => {
                            const isActive = isActiveType(type.id);
                            return (
                                <button
                                    key={type.id}
                                    className={`type-chip ${isActive ? 'active' : ''}`}
                                    onClick={() => handleNoteTypeChange(type.id as NoteTypeId)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 7,
                                        padding: '8px 14px',
                                        background: isActive ? styles.accentBg : styles.surface,
                                        border: `1px solid ${isActive ? styles.borderActive : styles.border}`,
                                        borderRadius: 20,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}
                                >
                                    <span className="chip-icon" style={{ fontSize: 13, transition: 'transform 0.2s ease' }}>{type.icon}</span>
                                    <span className="chip-label" style={{
                                        fontSize: 13,
                                        fontWeight: isActive ? 500 : 400,
                                        fontFamily: "'DM Sans', sans-serif",
                                        color: isActive ? styles.accent : styles.textMuted,
                                        transition: 'color 0.2s ease',
                                    }}>
                                        {type.id === 'ephemeral' && ephemeralHours
                                            ? (ephemeralHours === 24 ? '24h' : '7d')
                                            : type.id === 'capsule' && lockedUntil
                                                ? `Until ${new Date(lockedUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                                                : type.label}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Hidden date picker for capsule */}
                        <input id="capsule-date" type="date"
                            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                            onChange={e => setLockedUntil(e.target.value ? new Date(e.target.value).toISOString() : null)}
                        />
                    </div>

                    {/* Ephemeral time picker */}
                    <AnimatePresence>
                        {showEphemeralPicker && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                            >
                                <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                                    {EPHEMERAL_OPTIONS.map(opt => (
                                        <button key={opt.label}
                                            onClick={() => { setEphemeralHours(opt.value); setShowEphemeralPicker(false); }}
                                            style={{
                                                fontSize: 12, padding: '6px 16px', borderRadius: 20,
                                                border: `1px solid ${ephemeralHours === opt.value ? styles.borderActive : styles.border}`,
                                                background: ephemeralHours === opt.value ? styles.accentBg : styles.surface,
                                                color: ephemeralHours === opt.value ? styles.accent : styles.textMuted,
                                                cursor: 'pointer', transition: 'all 0.2s ease',
                                            }}
                                        >{opt.label}</button>
                                    ))}
                                    <button
                                        onClick={() => { setEphemeralHours(null); setShowEphemeralPicker(false); setNoteType('note'); }}
                                        style={{
                                            fontSize: 12, padding: '6px 16px', borderRadius: 20,
                                            border: `1px solid ${styles.border}`,
                                            background: styles.surface,
                                            color: styles.textMuted,
                                            cursor: 'pointer', transition: 'all 0.2s ease',
                                        }}
                                    >Off</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Subtle divider */}
                <div style={{
                    height: 1,
                    background: `linear-gradient(90deg, transparent, ${styles.border} 15%, ${styles.border} 85%, transparent)`,
                    margin: '0 18px',
                    flexShrink: 0,
                }} />

                {/* ═══════════════════════════════════════════ */}
                {/* ZONE 3: Writing Canvas                      */}
                {/* ═══════════════════════════════════════════ */}
                <div className="scroll-area" style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px 22px 32px',
                }}>
                    {/* Title */}
                    <textarea
                        ref={titleRef}
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            autoResize(e.target);
                        }}
                        placeholder={noteType === 'todo' ? 'Task list name...' : 'Title'}
                        rows={1}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: styles.text,
                            fontSize: 26,
                            fontFamily: "'Newsreader', Georgia, serif",
                            fontWeight: 400,
                            lineHeight: 1.3,
                            resize: 'none',
                            overflow: 'hidden',
                            width: '100%',
                            letterSpacing: '-0.01em',
                            outline: 'none',
                        }}
                    />

                    {/* Editor */}
                    <div className="capture-editor" style={{ marginTop: 14 }}>
                        <EditorContent editor={editor} />
                    </div>
                </div>

                {/* Link Autocomplete Dropdown */}
                <AnimatePresence>
                    {linkQuery !== null && linkResults.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            style={{
                                position: 'absolute',
                                bottom: 80,
                                left: 16,
                                right: 16,
                                zIndex: 40,
                                background: styles.surface,
                                border: `1px solid ${styles.border}`,
                                borderRadius: 12,
                                overflow: 'hidden',
                                maxHeight: 200,
                                overflowY: 'auto',
                            }}
                        >
                            <p style={{
                                fontSize: 10, color: styles.textDim, padding: '8px 14px',
                                borderBottom: `1px solid ${styles.border}`,
                                textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
                            }}>Link to note</p>
                            {linkResults.map(note => (
                                <button key={note.id} onClick={() => insertLink(note)}
                                    style={{
                                        width: '100%', textAlign: 'left', padding: '10px 14px',
                                        background: 'none', border: 'none', borderBottom: `1px solid ${styles.border}`,
                                        color: styles.text, fontSize: 14, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        transition: 'background 0.15s ease',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = styles.surfaceHover)}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                    <span style={{
                                        width: 24, height: 24, borderRadius: 6,
                                        background: styles.accentBg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, color: styles.accent, flexShrink: 0,
                                    }}>@</span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══════════════════════════════════════════ */}
                {/* ZONE 4: Bottom Toolbar                      */}
                {/* ═══════════════════════════════════════════ */}
                {editor && (
                    <div style={{
                        flexShrink: 0,
                        borderTop: `1px solid ${styles.border}`,
                        background: styles.surface,
                        padding: '0 6px',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 8px 6px',
                        }}>
                            {/* Left: formatting buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {/* Paragraph / Heading */}
                                <button
                                    className={`fmt-btn ${editor.isActive('heading') ? 'active' : ''}`}
                                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                                    style={{
                                        background: 'none', border: 'none', color: styles.textMuted,
                                        width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <line x1="3" y1="6" x2="21" y2="6" />
                                        <line x1="3" y1="12" x2="15" y2="12" />
                                        <line x1="3" y1="18" x2="18" y2="18" />
                                    </svg>
                                </button>

                                {/* Bullet list */}
                                <button
                                    className={`fmt-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
                                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                                    style={{
                                        background: 'none', border: 'none', color: styles.textMuted,
                                        width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <line x1="9" y1="6" x2="20" y2="6" />
                                        <line x1="9" y1="12" x2="20" y2="12" />
                                        <line x1="9" y1="18" x2="20" y2="18" />
                                        <circle cx="4" cy="6" r="1.5" fill="currentColor" />
                                        <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                                        <circle cx="4" cy="18" r="1.5" fill="currentColor" />
                                    </svg>
                                </button>

                                {/* Numbered list */}
                                <button
                                    className={`fmt-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
                                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                    style={{
                                        background: 'none', border: 'none', color: styles.textMuted,
                                        width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 14, fontWeight: 600,
                                    }}
                                >
                                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>1.</span>
                                </button>

                                {/* Checklist */}
                                <button
                                    className={`fmt-btn ${editor.isActive('taskList') ? 'active' : ''}`}
                                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                                    style={{
                                        background: 'none', border: 'none', color: styles.textMuted,
                                        width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="3" />
                                        <path d="M9 12l2 2 4-4" />
                                    </svg>
                                </button>

                                {/* Divider */}
                                <div style={{ width: 1, height: 20, background: styles.border, margin: '0 4px' }} />

                                {/* Bold */}
                                <button
                                    className={`fmt-btn ${editor.isActive('bold') ? 'active' : ''}`}
                                    onClick={() => editor.chain().focus().toggleBold().run()}
                                    style={{
                                        background: 'none', border: 'none', color: styles.textMuted,
                                        width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                                    }}
                                >B</button>

                                {/* Italic */}
                                <button
                                    className={`fmt-btn ${editor.isActive('italic') ? 'active' : ''}`}
                                    onClick={() => editor.chain().focus().toggleItalic().run()}
                                    style={{
                                        background: 'none', border: 'none', color: styles.textMuted,
                                        width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 15, fontStyle: 'italic', fontFamily: "Georgia, serif",
                                    }}
                                >I</button>

                                {/* Quote */}
                                <button
                                    className={`fmt-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
                                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                                    style={{
                                        background: 'none', border: 'none', color: styles.textMuted,
                                        width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 20, fontFamily: 'Georgia, serif', lineHeight: 1,
                                    }}
                                >&ldquo;</button>

                                {/* Voice */}
                                <button
                                    className={`fmt-btn ${isListening ? 'active' : ''}`}
                                    onClick={toggleVoice}
                                    style={{
                                        background: isListening ? 'rgba(248,113,113,0.15)' : 'none',
                                        border: 'none',
                                        color: isListening ? '#f87171' : styles.textMuted,
                                        width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <svg width="15" height="18" viewBox="0 0 15 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                        <rect x="4.5" y="1" width="6" height="11" rx="3" />
                                        <path d="M1 9a6.5 6.5 0 0013 0" />
                                        <line x1="7.5" y1="15" x2="7.5" y2="19" />
                                    </svg>
                                </button>
                            </div>

                            {/* Right: Save button */}
                            <button
                                className="save-btn"
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    background: saved
                                        ? 'rgba(52,211,153,0.15)'
                                        : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    border: 'none',
                                    borderRadius: 12,
                                    width: 44,
                                    height: 44,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: saving ? 'wait' : 'pointer',
                                    transition: 'all 0.3s ease',
                                    boxShadow: saved ? 'none' : `0 2px 16px ${styles.accentGlow}`,
                                    animation: saved ? 'checkPop 0.3s ease' : 'none',
                                    flexShrink: 0,
                                    marginLeft: 8,
                                    opacity: saving ? 0.6 : 1,
                                }}
                            >
                                {saving ? (
                                    <span className="material-symbols-outlined text-[20px] animate-spin" style={{ color: 'white' }}>progress_activity</span>
                                ) : saved ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12l5 5L19 7" />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12l5 5L19 7" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Safe area padding for mobile */}
                        <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
                    </div>
                )}
            </div>
        </>
    );
}

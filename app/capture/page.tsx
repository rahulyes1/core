'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useAutoSave } from '../../hooks/useAutoSave';
import FormattingToolbar from '../../components/capture/FormattingToolbar';
import KeyboardAccessory from '../../components/capture/KeyboardAccessory';
import { supabase } from '@/utils/supabase/client';
import { useAI } from '@/hooks/useAI';

export default function CapturePage() {
    const [content, setContent] = useState('');
    const [noteId, setNoteId] = useState<string | null>(null);
    const { result: aiResult, loading: aiLoading } = useAI(content);

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
                class: 'prose prose-invert prose-lg max-w-none focus:outline-none min-h-[calc(100vh-140px)] p-6',
            },
        },
        onUpdate: ({ editor }) => {
            setContent(editor.getHTML());
        },
        autofocus: true,
    });

    // Save Function
    const handleSave = async (htmlContent: string) => {
        if (!htmlContent || htmlContent === '<p></p>') return;

        // Ensure user is authenticated (anon or real)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            await supabase.auth.signInAnonymously();
        }

        const user_id = (await supabase.auth.getUser()).data.user?.id;
        if (!user_id) return;

        // Upsert note
        const { data: noteData, error } = await supabase.from('notes').upsert({
            id: noteId || undefined,
            content: htmlContent,
            user_id: user_id,
            updated_at: new Date().toISOString(),
            summary: aiResult?.summary // Update summary if available from AI
        }).select().single();

        if (error) {
            console.error('Error saving note:', error);
            return;
        }

        if (noteData) {
            setNoteId(noteData.id);

            // Handle Tags if AI result exists
            if (aiResult?.tags && aiResult.tags.length > 0) {
                for (const tagName of aiResult.tags) {
                    // 1. Insert Tag (Ignore conflict)
                    // Optimized: Try insert, ignore error, then select
                    // Actually, Supabase doesn't support "insert ignore" easily in client
                    // We will select first
                    const { data: existingTag } = await supabase
                        .from('tags')
                        .select('id')
                        .eq('name', tagName)
                        .single();

                    let tagId = existingTag?.id;

                    if (!tagId) {
                        const { data: newTag } = await supabase.from('tags').insert({ name: tagName }).select().single();
                        tagId = newTag?.id;
                    }

                    if (tagId) {
                        await supabase.from('note_tags').upsert({
                            note_id: noteData.id,
                            tag_id: tagId
                        });
                    }
                }
            }
        }
    };

    useAutoSave(content, handleSave);

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative text-white">
            <div className="flex items-center p-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-50">
                <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="ml-auto">
                    {aiLoading && <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />}
                </div>
            </div>

            <div className="flex-1 relative">
                {editor && editor.isEditable && (
                    <div className="fixed bottom-16 left-0 right-0 z-40 flex justify-center pb-2 pointer-events-none">
                        <div className="pointer-events-auto">
                            <FormattingToolbar editor={editor} />
                        </div>
                    </div>
                )}
                <EditorContent editor={editor} />

                {/* Helper visual for AI tags */}
                {aiResult?.tags && (
                    <div className="px-6 pb-2 flex gap-2 overflow-x-auto">
                        {aiResult.tags.map(tag => (
                            <span key={tag} className="text-xs text-neutral-500 animate-fade-in">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>

            <div className="sticky bottom-0 z-50 w-full">
                <KeyboardAccessory />
            </div>
        </div>
    );
}

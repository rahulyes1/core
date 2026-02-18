'use client';

import { Editor } from '@tiptap/react';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

interface FormattingToolbarProps {
    editor: Editor | null;
}

export default function FormattingToolbar({ editor }: FormattingToolbarProps) {
    if (!editor) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 bg-neutral-800/90 backdrop-blur-md rounded-lg p-1 shadow-xl border border-neutral-700">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded hover:bg-neutral-700 transition-colors ${editor.isActive('bold') ? 'text-white bg-neutral-700' : 'text-neutral-400'}`}
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded hover:bg-neutral-700 transition-colors ${editor.isActive('italic') ? 'text-white bg-neutral-700' : 'text-neutral-400'}`}
            >
                <Italic className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-neutral-700 mx-1" />
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded hover:bg-neutral-700 transition-colors ${editor.isActive('bulletList') ? 'text-white bg-neutral-700' : 'text-neutral-400'}`}
            >
                <List className="w-4 h-4" />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded hover:bg-neutral-700 transition-colors ${editor.isActive('orderedList') ? 'text-white bg-neutral-700' : 'text-neutral-400'}`}
            >
                <ListOrdered className="w-4 h-4" />
            </button>
        </div>
    );
}

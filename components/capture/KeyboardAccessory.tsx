'use client';

import { Mic, Image as ImageIcon, Bell } from 'lucide-react';

export default function KeyboardAccessory() {
    return (
        <div className="flex items-center gap-4 px-4 py-2 border-t border-neutral-800 bg-[#0a0a0a]">
            <button className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400">
                <Mic className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400">
                <ImageIcon className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-neutral-800 transition-colors text-neutral-400">
                <Bell className="w-5 h-5" />
            </button>
            <div className="flex-1" />
            <span className="text-xs text-neutral-600 font-medium">Auto-saving...</span>
        </div>
    );
}

'use client';

import Link from 'next/link';

export default function TopBar() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 glass-header">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2b6cee] to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                    C
                </div>
                <h1 className="text-lg font-bold tracking-tight text-white">Core</h1>
            </div>
            <div className="flex items-center gap-4">
                <button className="text-gray-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[24px]">search</span>
                </button>
                <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden border border-gray-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px] text-gray-400">person</span>
                </div>
            </div>
        </header>
    );
}

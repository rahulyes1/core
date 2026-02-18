'use client';

import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function TopBar() {
    const { user } = useAuth();

    const avatarUrl = user?.user_metadata?.avatar_url;
    const firstName = (user?.user_metadata?.full_name || '').split(' ')[0] || 'there';

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 glass-header gap-4">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br from-[#2b6cee] to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-[#2b6cee]/20">
                C
            </div>

            <Link href="/search" className="flex-1 h-10 rounded-full bg-white/5 border border-white/5 flex items-center px-4 gap-2 hover:bg-white/10 transition-colors group">
                <span className="material-symbols-outlined text-[20px] text-gray-400 group-hover:text-white transition-colors">search</span>
                <span className="text-sm text-gray-500 group-hover:text-gray-300">Search notes...</span>
            </Link>

            <Link href="/settings" className="w-8 h-8 shrink-0 rounded-full bg-gray-800 overflow-hidden border border-gray-700/50 flex items-center justify-center">
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                    <span className="text-xs font-semibold text-gray-300">{firstName.charAt(0)}</span>
                )}
            </Link>
        </header>
    );
}

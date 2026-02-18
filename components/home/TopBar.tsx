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
        <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 glass-header">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2b6cee] to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-[#2b6cee]/20">
                    C
                </div>
                <div className="flex flex-col">
                    <p className="text-[10px] text-gray-500 leading-none">{getGreeting()}</p>
                    <h1 className="text-base font-bold tracking-tight text-white leading-tight">{firstName}</h1>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Link href="/search" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-[20px] text-gray-400">search</span>
                </Link>
                <Link href="/settings" className="w-9 h-9 rounded-full bg-gray-800 overflow-hidden border border-gray-700/50 flex items-center justify-center">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <span className="text-sm font-semibold text-gray-300">{firstName.charAt(0)}</span>
                    )}
                </Link>
            </div>
        </header>
    );
}

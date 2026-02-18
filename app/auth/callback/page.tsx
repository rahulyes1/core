'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        // Supabase handles the token exchange from the URL hash automatically
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                router.replace('/');
            } else if (event === 'SIGNED_OUT') {
                router.replace('/login');
            }
        });

        // Also try to get session immediately (in case already processed)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                router.replace('/');
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2b6cee] to-purple-600 flex items-center justify-center text-white font-bold text-lg animate-pulse">
                    C
                </div>
                <p className="text-gray-500 text-sm">Signing you in...</p>
            </div>
        </div>
    );
}

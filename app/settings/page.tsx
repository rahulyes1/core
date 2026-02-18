'use client';

import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function SettingsPage() {
    const { user, signOut } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const avatarUrl = user?.user_metadata?.avatar_url;
    const fullName = user?.user_metadata?.full_name || 'User';
    const email = user?.email || '';

    const settingsGroups = [
        {
            title: 'Account',
            items: [
                { icon: 'person', label: 'Profile', desc: fullName, action: null },
                { icon: 'email', label: 'Email', desc: email, action: null },
            ]
        },
        {
            title: 'Preferences',
            items: [
                { icon: 'dark_mode', label: 'Theme', desc: 'Dark', action: null },
                { icon: 'text_fields', label: 'Font Size', desc: 'Medium', action: null },
                { icon: 'auto_awesome', label: 'AI Features', desc: 'Enabled', action: null },
            ]
        },
        {
            title: 'Data',
            items: [
                { icon: 'download', label: 'Export Notes', desc: 'Download all', action: null },
                { icon: 'archive', label: 'Archived Notes', desc: 'View', action: null },
                { icon: 'delete_sweep', label: 'Clear Cache', desc: 'Free up space', action: null },
            ]
        },
        {
            title: 'About',
            items: [
                { icon: 'info', label: 'Version', desc: '1.0.0 beta', action: null },
                { icon: 'code', label: 'Built with', desc: 'Next.js + Supabase', action: null },
            ]
        },
    ];

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 px-4 pt-14 pb-4">
                <h1 className="text-2xl font-bold text-white">Settings</h1>
            </div>

            <div className="flex-1 px-4 py-6 pb-28 space-y-6">
                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-gradient-to-br from-[#121212] to-[#1a1a1a] border border-white/5"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gray-800 overflow-hidden border-2 border-white/10 flex items-center justify-center shrink-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                                <span className="text-2xl font-bold text-gray-400">{fullName.charAt(0)}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-white truncate">{fullName}</h2>
                            <p className="text-sm text-gray-500 truncate">{email}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-400" />
                                <span className="text-xs text-green-400">Signed in with Google</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Settings Groups */}
                {settingsGroups.map((group, gi) => (
                    <motion.div
                        key={group.title}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.08 }}
                    >
                        <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold mb-2 px-1">{group.title}</p>
                        <div className="bg-[#121212] rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
                            {group.items.map((item) => (
                                <div key={item.label} className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-[20px] text-gray-400">{item.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white font-medium">{item.label}</p>
                                    </div>
                                    <p className="text-xs text-gray-600 shrink-0">{item.desc}</p>
                                    <span className="material-symbols-outlined text-[16px] text-gray-700">chevron_right</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}

                {/* Sign Out */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm hover:bg-red-500/15 active:scale-[0.99] transition-all"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </motion.div>

                {/* Footer */}
                <div className="text-center pt-4 pb-8">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2b6cee] to-purple-600 flex items-center justify-center text-white font-bold text-xs mx-auto mb-2">
                        C
                    </div>
                    <p className="text-[10px] text-gray-700">Core Notes v1.0.0</p>
                    <p className="text-[10px] text-gray-800">Made with ❤️</p>
                </div>
            </div>

            {/* Logout Confirmation */}
            {showLogoutConfirm && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                        onClick={() => setShowLogoutConfirm(false)}
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-[280px] shadow-2xl"
                    >
                        <div className="text-center">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="material-symbols-outlined text-[28px] text-red-400">logout</span>
                            </div>
                            <h3 className="text-white font-bold text-lg mb-1">Sign Out?</h3>
                            <p className="text-gray-500 text-sm mb-5">Your notes are safely stored in the cloud.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-medium text-sm hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={signOut}
                                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl px-4 pb-6 pt-3">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    {[
                        { href: '/', icon: 'home', active: false },
                        { href: '/search', icon: 'search', active: false },
                        { href: '/bookmarks', icon: 'bookmark', active: false },
                        { href: '/settings', icon: 'settings', active: true },
                    ].map(item => (
                        <Link key={item.href} href={item.href}
                            className={`flex flex-1 flex-col items-center justify-end gap-1 transition-colors ${item.active ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            <div className="flex h-7 items-center justify-center relative">
                                <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
                                {item.active && <span className="absolute -bottom-2 w-1 h-1 bg-[#2b6cee] rounded-full" />}
                            </div>
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}

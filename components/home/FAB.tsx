'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function FAB() {
    return (
        <Link href="/capture">
            <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2b6cee] to-[#1d5ad4] text-white shadow-lg shadow-[#2b6cee]/30 flex items-center justify-center hover:shadow-[#2b6cee]/50 transition-shadow"
            >
                <span className="material-symbols-outlined text-[28px]">add</span>
            </motion.div>
        </Link>
    );
}

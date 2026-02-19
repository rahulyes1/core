'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function FAB() {
    return (
        <Link href="/capture">
            <motion.div
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full bg-[#2b6cee] text-white shadow-[0_0_20px_rgba(43,108,238,0.5)] flex items-center justify-center border border-white/20 backdrop-blur-md"
            >
                <span className="material-symbols-outlined text-[28px]">add</span>
            </motion.div>
        </Link>
    );
}

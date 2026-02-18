'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function FAB() {
    return (
        <Link href="/capture">
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full bg-[#2b6cee]/90 text-white shadow-lg shadow-[#2b6cee]/20 backdrop-blur-md flex items-center justify-center hover:bg-[#2b6cee] transition-all group"
            >
                <span className="material-symbols-outlined text-[28px] group-hover:rotate-90 transition-transform duration-300">
                    add
                </span>
            </motion.button>
        </Link>
    );
}

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface AIResult {
    summary: string;
    tags: string[];
}

export function useAI(content: string, delay: number = 3000) {
    const [result, setResult] = useState<AIResult | null>(null);
    const [loading, setLoading] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastContent = useRef(content);

    const analyze = useCallback(async (text: string) => {
        if (!text || text.length < 10) return; // Don't analyze very short text

        setLoading(true);
        try {
            // Strip HTML tags for analysis
            const plainText = text.replace(/<[^>]*>?/gm, '');

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: plainText }),
            });

            if (response.ok) {
                const data = await response.json();
                setResult(data);
            }
        } catch (error) {
            console.error('AI Analysis failed:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (content !== lastContent.current) {
            timeoutRef.current = setTimeout(() => {
                analyze(content);
                lastContent.current = content;
            }, delay);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [content, delay, analyze]);

    return { result, loading };
}

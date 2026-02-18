'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useAutoSave(
    content: string,
    onSave: (content: string) => Promise<void>,
    delay: number = 3000
) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContent = useRef(content);

    const save = useCallback(async () => {
        if (content !== lastSavedContent.current) {
            console.log('Auto-saving...');
            await onSave(content);
            lastSavedContent.current = content;
            console.log('Saved.');
        }
    }, [content, onSave]);

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Don't schedule save if content hasn't changed from last save
        if (content !== lastSavedContent.current) {
            timeoutRef.current = setTimeout(() => {
                save();
            }, delay);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [content, delay, save]);

    // Force save on unmount or navigation could be handled by a separate effect or hook call
    // For now, simpler auto-save on timer is robust enough for "typing stops"

    return { saveNow: save };
}

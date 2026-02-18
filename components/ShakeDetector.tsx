'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ShakeDetector() {
    const router = useRouter();

    useEffect(() => {
        let lastX = 0, lastY = 0, lastZ = 0;
        let lastTime = Date.now();
        const SHAKE_THRESHOLD = 30;

        const handleMotion = (e: DeviceMotionEvent) => {
            const acc = e.accelerationIncludingGravity;
            if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

            const now = Date.now();
            const timeDiff = now - lastTime;
            if (timeDiff < 100) return;

            const deltaX = Math.abs(acc.x - lastX);
            const deltaY = Math.abs(acc.y - lastY);
            const deltaZ = Math.abs(acc.z - lastZ);
            const speed = (deltaX + deltaY + deltaZ) / (timeDiff / 1000);

            if (speed > SHAKE_THRESHOLD) {
                router.push('/capture');
            }

            lastX = acc.x;
            lastY = acc.y;
            lastZ = acc.z;
            lastTime = now;
        };

        // Request permission on iOS 13+
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            (DeviceMotionEvent as any).requestPermission().then((state: string) => {
                if (state === 'granted') {
                    window.addEventListener('devicemotion', handleMotion);
                }
            }).catch(() => { });
        } else {
            window.addEventListener('devicemotion', handleMotion);
        }

        return () => window.removeEventListener('devicemotion', handleMotion);
    }, [router]);

    return null;
}

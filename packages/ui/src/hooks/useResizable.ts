import { useEffect } from 'react';

const MIN_VIDEO_W = 214; // 120 * 16/9 — ensures video area stays above minimum
const MIN_VIDEO_H = 120;

export function useResizable(
    handleRef: React.RefObject<HTMLDivElement | null>,
    targetRef: React.RefObject<HTMLDivElement | null>,
    onResize?: () => void,
    aspectRatio?: number,
    extraHeight = 0
) {
    useEffect(() => {
        const handle = handleRef.current;
        const target = targetRef.current;
        if (!handle || !target) return;

        let startX = 0, startY = 0, startW = 0, startH = 0, startL = 0, startT = 0;

        const onMouseDown = (e: MouseEvent) => {
            e.stopPropagation();
            const zoom = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--app-zoom').trim()
            ) || 1;
            startX = e.clientX;
            startY = e.clientY;
            const rect = target.getBoundingClientRect();
            startW = rect.width / zoom;
            startH = rect.height / zoom;
            startL = rect.left / zoom;
            startT = rect.top / zoom;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            const zoom = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--app-zoom').trim()
            ) || 1;
            const dx = (startX - e.clientX) / zoom;
            const dy = (e.clientY - startY) / zoom;

            let newW = startW + dx;
            let newH = startH + dy;

            if (aspectRatio && aspectRatio > 0) {
                const videoStartH = startH - extraHeight;
                const scaleW = newW / startW;
                const scaleH = videoStartH > 0 ? (videoStartH + dy) / videoStartH : scaleW;
                const scale = Math.max(scaleW, scaleH);

                newW = Math.round(Math.max(MIN_VIDEO_W, startW * scale));
                const videoH = Math.round(newW / aspectRatio);
                newH = Math.max(MIN_VIDEO_H, videoH) + extraHeight;
            } else {
                newW = Math.max(MIN_VIDEO_W, newW);
                newH = Math.max(MIN_VIDEO_H, newH);
            }

            target.style.width = `${newW}px`;
            target.style.height = `${newH}px`;
            target.style.left = `${startL - (newW - startW)}px`;
            target.style.top = `${startT}px`;
            target.style.right = 'auto';
            target.style.bottom = 'auto';
            if (onResize) onResize();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        handle.addEventListener('mousedown', onMouseDown);
        return () => handle.removeEventListener('mousedown', onMouseDown);
    }, [handleRef.current, targetRef.current, onResize, aspectRatio, extraHeight]);
}

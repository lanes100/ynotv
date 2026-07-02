import { useEffect } from 'react';

// useDraggable.ts
export function useDraggable(ref: React.RefObject<HTMLDivElement | null>, onDrag?: () => void) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        const onMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).tagName === 'BUTTON') return;
            const zoom = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--app-zoom').trim()
            ) || 1;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            startLeft = rect.left / zoom;
            startTop = rect.top / zoom;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            const zoom = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--app-zoom').trim()
            ) || 1;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = `${startLeft + (dx / zoom)}px`;
            el.style.top = `${startTop + (dy / zoom)}px`;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            if (onDrag) onDrag();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        el.addEventListener('mousedown', onMouseDown);
        return () => el.removeEventListener('mousedown', onMouseDown);
    }, [ref.current, onDrag]); // Rebind when the ref points to a new DOM element (e.g. layout change)
}

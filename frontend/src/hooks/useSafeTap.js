import { useEffect, useRef } from "react";

/**
 * Hook for touch/pointer interactions that distinguishes between:
 * 1. Clean tap / click -> triggers onTap
 * 2. Long press -> triggers onLongPress (if specified)
 * 3. Drag / swipe / scroll -> cancels action and does NOT trigger onTap or onLongPress.
 *
 * Prevents accidental likes and activations when swiping/scrolling through feeds.
 */
export function useSafeTap({
  onTap,
  onLongPress,
  longPressDelay = 450,
  moveThreshold = 8,
} = {}) {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const isMovedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const onTapRef = useRef(onTap);
  const onLongPressRef = useRef(onLongPress);

  useEffect(() => {
    onTapRef.current = onTap;
    onLongPressRef.current = onLongPress;
  });

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handlePointerDown = (e) => {
    // Only respond to primary button (left mouse click or touch)
    if (e.button !== undefined && e.button !== 0) return;

    clearTimer();
    isLongPressRef.current = false;
    isMovedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    if (onLongPressRef.current) {
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        timerRef.current = null;
        onLongPressRef.current?.();
      }, longPressDelay);
    }
  };

  const handlePointerMove = (e) => {
    if (isMovedRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > moveThreshold) {
      isMovedRef.current = true;
      clearTimer();
    }
  };

  const handlePointerUp = () => {
    clearTimer();
  };

  const handlePointerCancel = () => {
    isMovedRef.current = true;
    clearTimer();
  };

  const handleTouchMove = (e) => {
    if (isMovedRef.current) return;
    const touch = e.touches?.[0];
    if (touch) {
      const dx = touch.clientX - startPosRef.current.x;
      const dy = touch.clientY - startPosRef.current.y;
      if (Math.hypot(dx, dy) > moveThreshold) {
        isMovedRef.current = true;
        clearTimer();
      }
    } else {
      isMovedRef.current = true;
      clearTimer();
    }
  };

  const handleTouchCancel = () => {
    isMovedRef.current = true;
    clearTimer();
  };

  const handleContextMenu = (e) => {
    if (isLongPressRef.current) {
      e.preventDefault();
    }
  };

  const handleClick = (e) => {
    // If interaction was a long-press or gesture moved (scroll/swipe), prevent triggering tap!
    if (isLongPressRef.current || isMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      isMovedRef.current = false;
      return;
    }
    onTapRef.current?.(e);
  };

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onTouchMove: handleTouchMove,
    onTouchCancel: handleTouchCancel,
    onContextMenu: handleContextMenu,
    onClick: handleClick,
    isLongPressRef,
  };
}

export default useSafeTap;

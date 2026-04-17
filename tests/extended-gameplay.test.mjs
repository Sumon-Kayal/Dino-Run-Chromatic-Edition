// extended-gameplay.test.mjs

import {gamePause, gameResume, verifyWallClockTime, visibilityChangeHandler, toggleFullscreen, debouncedClickHandler} from './gameLogic.js';

describe('Extended Gameplay Tests', () => {
    test('Pause and resume cycles', () => {
        const initialState = getGameState();
        expect(gamePause()).toBe(true);
        expect(getGameState()).toEqual({...initialState, paused: true});
        expect(gameResume()).toBe(true);
        expect(getGameState()).toEqual({...initialState, paused: false});
    });

    test('Wall-clock time offset verification', () => {
        const startTime = new Date();
        gamePause();
        const pauseTime = new Date();
        gameResume();
        const endTime = new Date();
        const offset = verifyWallClockTime(startTime, pauseTime, endTime);
        expect(offset).toBeLessThanOrEqual(1000); // Check for a 1-second offset
    });

    test('Visibility change handler race conditions', () => {
        let visibilityChangeCount = 0;
        const mockHandler = () => visibilityChangeCount++;
        document.addEventListener('visibilitychange', mockHandler);
        document.hidden = true;
        visibilityChangeHandler();
        expect(visibilityChangeCount).toBe(1);
        document.hidden = false;
        visibilityChangeHandler();
        expect(visibilityChangeCount).toBe(2);
        document.removeEventListener('visibilitychange', mockHandler);
    });

    test('Fullscreen canvas scaling', () => {
        const canvas = document.createElement('canvas');
        toggleFullscreen(canvas);
        expect(canvas.width).toBe(window.innerWidth);
        expect(canvas.height).toBe(window.innerHeight);
    });

    test('Multi-click input debouncing', () => {
        let clickCount = 0;
        const debouncedHandler = debouncedClickHandler(() => clickCount++);
        debouncedHandler();
        debouncedHandler();
        expect(clickCount).toBe(1); // Only one click should register
    });
});

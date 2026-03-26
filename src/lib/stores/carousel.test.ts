import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createCarouselStore } from './carousel';

describe('carouselStore', () => {
	let store: ReturnType<typeof createCarouselStore>;

	beforeEach(() => {
		store = createCarouselStore(4); // 4 items
	});

	it('starts at index 0', () => {
		expect(get(store).activeIndex).toBe(0);
	});

	it('next() advances index', () => {
		store.next();
		expect(get(store).activeIndex).toBe(1);
	});

	it('prev() decrements index', () => {
		store.next();
		store.prev();
		expect(get(store).activeIndex).toBe(0);
	});

	it('does not go below 0', () => {
		store.prev();
		expect(get(store).activeIndex).toBe(0);
	});

	it('does not exceed total - 1', () => {
		store.next();
		store.next();
		store.next();
		store.next();
		expect(get(store).activeIndex).toBe(3);
	});

	it('setIndex() jumps to index', () => {
		store.setIndex(2);
		expect(get(store).activeIndex).toBe(2);
	});

	it('prevIndex and nextIndex are correct', () => {
		store.setIndex(1);
		const state = get(store);
		expect(state.prevIndex).toBe(0);
		expect(state.nextIndex).toBe(2);
	});

	it('prevIndex is null at start', () => {
		expect(get(store).prevIndex).toBeNull();
	});

	it('nextIndex is null at end', () => {
		store.setIndex(3);
		expect(get(store).nextIndex).toBeNull();
	});
});

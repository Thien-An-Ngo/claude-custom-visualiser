import { writable, derived } from 'svelte/store';

interface CarouselState {
	activeIndex: number;
	total: number;
	prevIndex: number | null;
	nextIndex: number | null;
}

export function createCarouselStore(total: number) {
	const index = writable(0);

	const state = derived(
		index,
		($i): CarouselState => ({
			activeIndex: $i,
			total,
			prevIndex: $i > 0 ? $i - 1 : null,
			nextIndex: $i < total - 1 ? $i + 1 : null
		})
	);

	return {
		subscribe: state.subscribe,
		next: () => index.update((i) => Math.min(i + 1, total - 1)),
		prev: () => index.update((i) => Math.max(i - 1, 0)),
		setIndex: (i: number) => index.set(Math.max(0, Math.min(i, total - 1)))
	};
}

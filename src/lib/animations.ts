import { gsap } from 'gsap';

/**
 * Landing page entry: sigil blooms, wordmark tracks in, divider slides, cards stagger up.
 * Call once on landing page mount.
 */
export function animateLandingEntry(refs: {
	sigil: Element;
	wordmark: Element;
	divider: Element;
	cards: Element[];
}) {
	const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

	tl.fromTo(
		refs.sigil,
		{ opacity: 0, scale: 0.6, rotate: 45 },
		{ opacity: 1, scale: 1, rotate: 45, duration: 0.8 }
	)
		.fromTo(
			refs.wordmark,
			{ opacity: 0, letterSpacing: '24px' },
			{ opacity: 1, letterSpacing: '8px', duration: 0.6 },
			'-=0.3'
		)
		.fromTo(
			refs.divider,
			{ scaleY: 0, transformOrigin: 'top center' },
			{ scaleY: 1, duration: 0.5 },
			'-=0.2'
		)
		.fromTo(
			refs.cards,
			{ opacity: 0, y: 24 },
			{ opacity: 1, y: 0, duration: 0.4, stagger: 0.08 },
			'-=0.2'
		);

	return tl;
}

/**
 * Carousel transition: expands active card, compresses others.
 * Call on every index change.
 */
export function animateCarouselChange(refs: { activeCard: Element; ghostCards: Element[] }) {
	const tl = gsap.timeline({ defaults: { ease: 'power2.inOut', duration: 0.35 } });

	tl.to(refs.activeCard, { opacity: 1, y: 0 }).to(refs.ghostCards, { opacity: 0.35, y: 0 }, '<');

	return tl;
}

/**
 * Project page entry: sidebar slides in from left, content fades+translates up.
 * Call on project route mount.
 */
export function animateProjectEntry(refs: { sidebar: Element; topbar: Element; content: Element }) {
	const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

	tl.fromTo(refs.sidebar, { x: -48, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5 })
		.fromTo(refs.topbar, { opacity: 0 }, { opacity: 1, duration: 0.3 }, '-=0.2')
		.fromTo(refs.content, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.15');

	return tl;
}

/**
 * Project page exit: reverse of entry.
 * Call before navigating away from a project route.
 */
export function animateProjectExit(refs: { sidebar: Element; topbar: Element; content: Element }) {
	const tl = gsap.timeline({ defaults: { ease: 'power2.in' } });

	tl.to(refs.content, { opacity: 0, y: -12, duration: 0.25 })
		.to(refs.topbar, { opacity: 0, duration: 0.2 }, '-=0.1')
		.to(refs.sidebar, { x: -48, opacity: 0, duration: 0.3 }, '-=0.1');

	return tl;
}

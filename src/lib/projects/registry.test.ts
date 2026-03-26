import { describe, it, expect } from 'vitest';
import { registry, getRegistryList } from './registry';

describe('registry', () => {
	it('has at least one entry', () => {
		expect(Object.keys(registry).length).toBeGreaterThan(0);
	});

	it('design-system entry exists', () => {
		expect(registry['design-system']).toBeDefined();
	});

	it('design-system entry has required fields', () => {
		const entry = registry['design-system'];
		expect(entry.title).toBe('Design System');
		expect(entry.tags).toContain('COLOR');
		expect(typeof entry.component).toBe('function');
		expect(typeof entry.config).toBe('function');
	});

	it('getRegistryList returns a non-empty array', () => {
		const list = getRegistryList();
		expect(Array.isArray(list)).toBe(true);
		expect(list[0].slug).toBeDefined();
	});
});

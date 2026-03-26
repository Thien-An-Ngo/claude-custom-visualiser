import { describe, it, expect } from 'vitest';
import { listProjects, getProject } from './client';

describe('api/client', () => {
	it('listProjects returns array with at least one entry', async () => {
		const projects = await listProjects();
		expect(Array.isArray(projects)).toBe(true);
		expect(projects.length).toBeGreaterThan(0);
	});

	it('listProjects entries have slug and title', async () => {
		const [first] = await listProjects();
		expect(first.slug).toBeDefined();
		expect(first.title).toBeDefined();
	});

	it('getProject returns project by slug', async () => {
		const project = await getProject('design-system');
		expect(project.slug).toBe('design-system');
		expect(project.sections).toBeDefined();
	});

	it('getProject throws for unknown slug', async () => {
		await expect(getProject('nonexistent')).rejects.toThrow();
	});
});

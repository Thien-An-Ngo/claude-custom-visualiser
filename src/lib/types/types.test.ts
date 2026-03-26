import { describe, it, expectTypeOf } from 'vitest';
import type { Project, ProjectMeta, Section } from './index';

describe('types', () => {
	it('Project has required fields', () => {
		const p: Project = {
			slug: 'test',
			title: 'Test',
			description: 'desc',
			tags: ['A'],
			status: 'new',
			sections: []
		};
		expectTypeOf(p.slug).toBeString();
		expectTypeOf(p.sections).toBeArray();
	});

	it('Section has type and data fields', () => {
		const s: Section = { type: 'colour-palette', data: {} };
		expectTypeOf(s.type).toBeString();
	});

	it('ProjectMeta does not include sections', () => {
		expectTypeOf<ProjectMeta>().not.toHaveProperty('sections');
	});
});

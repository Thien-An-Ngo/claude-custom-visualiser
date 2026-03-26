import type { ProjectMeta } from '$lib/types';

export const registry: Record<string, ProjectMeta> = {
	'design-system': {
		slug: 'design-system',
		title: 'Design System',
		description: 'Color palette, typography scale, and spacing tokens.',
		tags: ['COLOR', 'TYPE', 'TOKENS'],
		status: 'new',
		component: () => import('./design-system/Visualiser.svelte'),
		config: () => import('./design-system/config.json')
	}
};

/** Returns registry entries as an ordered array, preserving insertion order. */
export function getRegistryList(): ProjectMeta[] {
	return Object.values(registry);
}

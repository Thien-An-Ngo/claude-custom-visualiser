import { getRegistryList, registry } from '$lib/projects/registry';
import type { Project, ProjectMeta } from '$lib/types';

/**
 * Returns all registered projects as metadata (no sections).
 * FUTURE: replace body with fetch('/api/projects')
 */
export async function listProjects(): Promise<ProjectMeta[]> {
	return getRegistryList();
}

/**
 * Returns a single project with full section data.
 * FUTURE: replace body with fetch(`/api/projects/${slug}`)
 */
export async function getProject(slug: string): Promise<Project> {
	const entry = registry[slug];
	if (!entry) throw new Error(`Project not found: ${slug}`);
	const module = await entry.config();
	return module.default;
}

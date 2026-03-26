export type ProjectStatus = 'new' | 'updated' | 'stable';

export interface Section {
	type: string;
	data: Record<string, unknown>;
}

export interface ProjectMeta {
	slug: string;
	title: string;
	description: string;
	tags: string[];
	status: ProjectStatus;
	/** Lazy-load the Visualiser component */
	component: () => Promise<{ default: unknown }>;
	/** Lazy-load the config JSON */
	config: () => Promise<Project>;
}

export interface Project {
	slug: string;
	title: string;
	description: string;
	tags: string[];
	status: ProjectStatus;
	sections: Section[];
}

export interface ApiResponse<T> {
	data: T;
	error?: string;
}

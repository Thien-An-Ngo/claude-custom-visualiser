import type { Component } from 'svelte';

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
	component: () => Promise<{ default: Component }>;
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

export type ApiResponse<T> =
	| { data: T; error?: never }
	| { data?: never; error: string };

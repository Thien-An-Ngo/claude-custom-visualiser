<script lang="ts">
	import '../app.css';
	import GridBackground from '$lib/components/layout/GridBackground.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<GridBackground />

<div class="layout-root">
	{@render children()}
</div>

<style>
	.layout-root {
		position: relative;
		z-index: 1;
		min-height: 100vh;
	}
</style>

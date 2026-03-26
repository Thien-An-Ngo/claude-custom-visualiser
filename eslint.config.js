import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
	js.configs.recommended,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			globals: { ...globals.browser, ...globals.node }
		},
		plugins: { '@typescript-eslint': ts },
		rules: {
			...ts.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'warn'
		}
	},
	{
		files: ['**/*.svelte'],
		plugins: { svelte },
		processor: svelte.processors['.svelte'],
		rules: { ...svelte.configs.recommended.rules }
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'node_modules/']
	}
];

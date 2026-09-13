<script lang="ts">
	import markSvg from '$lib/assets/logo-mark.svg?raw';
	import { cn } from '$lib/utils';

	// Inline SVG (not <img>) so the ink parts inherit currentColor and follow the theme.
	// Decorative by default; pass `label` when the mark stands alone.
	let { class: className = '', label }: { class?: string; label?: string } = $props();
</script>

<span
	class={cn('logo-mark inline-block shrink-0', className)}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted, bundled SVG asset -->
	{@html markSvg}
</span>

<style>
	.logo-mark :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
		color: inherit;
	}
</style>

<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { mode, toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';

	const isDark = $derived(mode.current === 'dark');
</script>

<Button
	variant="ghost"
	size="icon"
	onclick={toggleMode}
	aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
>
	{#if isDark}
		<Sun aria-hidden="true" />
	{:else}
		<Moon aria-hidden="true" />
	{/if}
</Button>

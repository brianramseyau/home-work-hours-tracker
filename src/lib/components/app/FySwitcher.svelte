<script lang="ts">
	import type { FySummary } from '$lib/core/fy';

	// Phase 01: shows the current financial year and links to year management. Phase 03 turns
	// this into a picker once more than one year can exist.
	let { fy, compact = false }: { fy: FySummary; compact?: boolean } = $props();
</script>

{#if compact}
	<a
		href="/years"
		class="rounded-md border px-2.5 py-1 font-display text-sm font-semibold hover:bg-accent"
		aria-label={`${fy.label}, ${fy.range}. Manage years`}
	>
		{fy.label}
	</a>
{:else}
	<a href="/years" class="flex flex-col rounded-lg border bg-card px-3 py-2.5 hover:bg-accent">
		<span class="font-display text-xl leading-tight font-semibold">{fy.label}</span>
		<span class="text-xs text-muted-foreground">{fy.range}</span>
		<span class="sr-only">Manage years</span>
	</a>
{/if}

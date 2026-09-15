<script lang="ts">
	import Settings from '@lucide/svelte/icons/settings';
	import * as Popover from '$lib/components/ui/popover';
	import { cn } from '$lib/utils.js';
	import type { FySummary } from '$lib/core/fy';

	// The badge opens a pop-out listing every financial year (newest first) for quick switching;
	// the cog in its header goes to the years CRUD page. `fy` is what the badge displays (the
	// year being viewed, or the current open period off-diary); `currentStartYear` is the year
	// the URL is actually on, so only a real `/[fy]` page marks a row as current.
	let {
		fy,
		years,
		currentStartYear = null,
		compact = false
	}: {
		fy: FySummary;
		years: FySummary[];
		currentStartYear?: number | null;
		compact?: boolean;
	} = $props();

	let open = $state(false);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			{#if compact}
				<button
					{...props}
					class="rounded-md border px-2.5 py-1 font-display text-sm font-semibold hover:bg-accent"
					aria-label={`${fy.label}, ${fy.range}. Switch financial year`}
				>
					{fy.label}
				</button>
			{:else}
				<button
					{...props}
					class="flex flex-col items-start rounded-lg border bg-card px-3 py-2.5 text-left hover:bg-accent"
				>
					<span class="font-display text-xl leading-tight font-semibold">{fy.label}</span>
					<span class="text-xs text-muted-foreground">{fy.range}</span>
					<span class="sr-only">Switch financial year</span>
				</button>
			{/if}
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		align={compact ? 'end' : 'start'}
		class="w-64 p-0"
		role="dialog"
		aria-label="Financial years"
	>
		<div class="flex items-center justify-between border-b px-3 py-2">
			<span class="text-xs font-medium text-muted-foreground">Financial years</span>
			<a
				href="/years"
				onclick={() => (open = false)}
				class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label="Manage financial years"
			>
				<Settings class="size-4" />
			</a>
		</div>
		{#if years.length === 0}
			<p class="px-3 py-2 text-sm text-muted-foreground">No financial years yet.</p>
		{:else}
			<ul class="max-h-80 overflow-y-auto p-1">
				{#each years as year (year.startYear)}
					<li>
						<a
							href={`/${year.slug}`}
							onclick={() => (open = false)}
							aria-current={year.startYear === currentStartYear ? 'page' : undefined}
							class={cn(
								'flex items-baseline justify-between gap-3 rounded-md px-2.5 py-1.5 hover:bg-accent',
								year.startYear === currentStartYear && 'bg-accent'
							)}
						>
							<span class="font-display text-sm font-semibold">{year.label}</span>
							<span class="text-xs text-muted-foreground">{year.range}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</Popover.Content>
</Popover.Root>

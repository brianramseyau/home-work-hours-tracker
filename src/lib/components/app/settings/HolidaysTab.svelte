<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { fySummary } from '$lib/core/fy';
	import HolidayRow from './HolidayRow.svelte';

	interface HolidayData {
		id: number;
		name: string;
		source: 'bundled' | 'custom';
		disabled: boolean;
		displayDate: string;
	}

	let {
		holidays,
		fy
	}: {
		holidays: HolidayData[];
		fy: { startYear: number; label: string };
	} = $props();

	const previousFy = $derived(fySummary(fy.startYear - 1));
	const nextFy = $derived(fySummary(fy.startYear + 1));
</script>

<div class="max-w-lg">
	<div class="mb-4 flex items-center gap-2">
		<Button
			variant="ghost"
			size="icon"
			href={`?fy=${previousFy.slug}`}
			aria-label={`Show ${previousFy.label}`}
		>
			<ChevronLeft aria-hidden="true" />
		</Button>
		<span class="font-display text-lg font-semibold">{fy.label}</span>
		<Button
			variant="ghost"
			size="icon"
			href={`?fy=${nextFy.slug}`}
			aria-label={`Show ${nextFy.label}`}
		>
			<ChevronRight aria-hidden="true" />
		</Button>
	</div>

	{#if holidays.length === 0}
		<p class="text-sm text-muted-foreground">{`No holidays recorded for ${fy.label}.`}</p>
	{:else}
		<div>
			{#each holidays as holiday (holiday.id)}
				<HolidayRow {holiday} />
			{/each}
		</div>
	{/if}

	<form
		method="POST"
		action="?/holidayCreate"
		use:enhance
		class="mt-6 flex flex-wrap items-end gap-3"
	>
		<div class="flex flex-col gap-1">
			<Label for="new-holiday-date">Date</Label>
			<Input id="new-holiday-date" name="date" type="date" class="w-40" />
		</div>
		<div class="flex flex-col gap-1">
			<Label for="new-holiday-name">Name</Label>
			<Input id="new-holiday-name" name="name" class="w-56" />
		</div>
		<div class="flex items-center gap-2 pb-1.5">
			<input
				id="new-holiday-repeats"
				name="repeatsYearly"
				type="checkbox"
				class="size-4 rounded border-input"
			/>
			<Label for="new-holiday-repeats">Repeats every year</Label>
		</div>
		<Button type="submit">Add holiday</Button>
	</form>
</div>

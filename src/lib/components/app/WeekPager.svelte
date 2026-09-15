<script lang="ts">
	import { untrack } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';
	import DayRow from './DayRow.svelte';
	import { diaryOfficeName, type DiaryDay, type DiaryOffice } from '$lib/core/diary';

	let {
		weeks,
		currentWeek,
		onOpenDay,
		offices = []
	}: {
		weeks: DiaryDay[][];
		currentWeek: number;
		onOpenDay: (date: string) => void;
		offices?: DiaryOffice[];
	} = $props();

	// weeks is never empty: every financial year has at least one week, and each bucket
	// groupDiaryDaysByWeek produces always has at least one day in it.
	let weekIndex = $state(untrack(() => weeks.findIndex((week) => week[0].week === currentWeek)));
	const safeIndex = $derived(Math.min(Math.max(weekIndex, 0), weeks.length - 1));
	const week = $derived(weeks[safeIndex]);
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center justify-between">
		<Button
			variant="ghost"
			size="icon"
			aria-label="Previous week"
			disabled={safeIndex === 0}
			onclick={() => (weekIndex = safeIndex - 1)}
		>
			<ChevronLeft class="size-4" />
		</Button>
		<p class="text-sm font-medium">{`Week ${week[0].week}`}</p>
		<Button
			variant="ghost"
			size="icon"
			aria-label="Next week"
			disabled={safeIndex === weeks.length - 1}
			onclick={() => (weekIndex = safeIndex + 1)}
		>
			<ChevronRight class="size-4" />
		</Button>
	</div>

	<div>
		{#each week as day (day.date)}
			<DayRow {day} officeName={diaryOfficeName(day, offices)} onOpen={onOpenDay} />
		{/each}
	</div>
</div>

<script lang="ts">
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import TypeSwatch from './TypeSwatch.svelte';
	import { formatShortDate } from '$lib/core/date';
	import { diaryDayLabel, isUpcoming, type DiaryDay } from '$lib/core/diary';
	import { formatHours } from '$lib/core/time';

	let { day, onOpen }: { day: DiaryDay; onOpen: (date: string) => void } = $props();
</script>

<button
	type="button"
	onclick={() => onOpen(day.date)}
	class={`flex w-full items-center gap-3 border-b py-2.5 text-left last:border-b-0 ${day.status === 'ghost' ? 'text-muted-foreground' : ''}`}
>
	<TypeSwatch type={day.displayType} future={isUpcoming(day)} class="size-4 shrink-0" />
	<span class="w-16 shrink-0 text-sm text-muted-foreground">
		{formatShortDate(day.date)}
	</span>
	<span class="flex-1 text-sm font-medium">{diaryDayLabel(day)}</span>
	{#if day.source === 'prefill' || day.status === 'ghost'}
		<Sparkles class="size-3.5 text-muted-foreground" aria-hidden="true" title="From schedule" />
		<span class="sr-only">From schedule</span>
	{/if}
	{#if day.notes}
		<NotebookPen class="size-3.5 text-muted-foreground" aria-hidden="true" />
		<span class="sr-only">Has a note</span>
	{/if}
	<span class="w-14 shrink-0 text-right text-sm tabular">
		{day.homeMinutes > 0 ? `${formatHours(day.homeMinutes)} h` : ''}
	</span>
</button>

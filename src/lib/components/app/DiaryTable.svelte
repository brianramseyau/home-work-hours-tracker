<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { Button } from '$lib/components/ui/button';
	import TypeSwatch from './TypeSwatch.svelte';
	import { weekdayShort } from '$lib/core/date';
	import { displayTypeLabel } from '$lib/core/dayType';
	import type { DiaryDay } from '$lib/core/diary';
	import { formatHours } from '$lib/core/time';

	let {
		weeks,
		onOpenDay,
		finalised = false
	}: { weeks: DiaryDay[][]; onOpenDay: (date: string) => void; finalised?: boolean } = $props();

	const flatDays = $derived(weeks.flat());

	let focusedDate = $state<string | null>(null);
	let editingDate = $state<string | null>(null);
	let editStart = $state('');
	let editEnd = $state('');
	// Snapshots page.form when an inline edit opens, so a save result already sitting there from
	// a previous edit doesn't immediately close this fresh one before it even submits.
	let openedWithForm: unknown = null;

	const savedDate = $derived.by(() => {
		const form = page.form as { form?: string; date?: string; success?: boolean } | null;
		return form && form.form === 'day' && form.success && form !== openedWithForm
			? form.date
			: null;
	});

	$effect(() => {
		if (savedDate && savedDate === editingDate) editingDate = null;
	});

	function weekRange(week: DiaryDay[]): string {
		return `${week[0].date.slice(8, 10)}–${week.at(-1)!.date.slice(8, 10)}`;
	}

	// Only ever called from the times button below, which is disabled unless this is exactly
	// the single-block home day it needs to be — so day.blocks[0] is always safe to read.
	function startInlineEdit(day: DiaryDay) {
		openedWithForm = page.form;
		editingDate = day.date;
		editStart = day.blocks[0].start;
		editEnd = day.blocks[0].end;
	}

	function cancelInlineEdit() {
		editingDate = null;
	}

	function canEditInline(day: DiaryDay): boolean {
		return !finalised && day.displayType === 'home' && day.blocks.length === 1;
	}

	function moveFocus(delta: number) {
		const currentIndex = flatDays.findIndex((day) => day.date === focusedDate);
		const nextIndex = Math.min(Math.max(currentIndex + delta, 0), flatDays.length - 1);
		focusedDate = flatDays[nextIndex].date;
		document.getElementById(`day-row-${focusedDate}`)?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'j') {
			event.preventDefault();
			moveFocus(1);
		} else if (event.key === 'k') {
			event.preventDefault();
			moveFocus(-1);
		} else if (event.key === 'Enter' && focusedDate) {
			event.preventDefault();
			onOpenDay(focusedDate);
		} else if (event.key === 'Escape') {
			cancelInlineEdit();
		}
	}

	// A global listener, not a template `onkeydown`: j/k/Enter/Esc are keyboard shortcuts for
	// whichever row has focus, not an interaction on the (non-interactive) <table> element itself.
	$effect(() => {
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

<table class="w-full text-sm">
	<caption class="sr-only">Financial year diary, one row per day</caption>
	<tbody>
		{#each weeks as week (week[0].week)}
			<tr>
				<th
					colspan="6"
					scope="colgroup"
					class="sticky top-0 z-10 bg-background/95 py-1 text-left text-xs font-medium text-muted-foreground backdrop-blur"
				>
					{`Week ${week[0].week} (${weekRange(week)})`}
				</th>
			</tr>
			{#each week as day (day.date)}
				<tr
					id={`day-row-${day.date}`}
					tabindex="0"
					onfocus={() => (focusedDate = day.date)}
					class="border-b outline-none focus-visible:bg-accent"
				>
					<td class="py-1.5 pr-2">
						<TypeSwatch type={day.displayType} future={day.status === 'future'} class="size-3.5" />
					</td>
					<td class="py-1.5 pr-2">
						<button
							type="button"
							class="text-muted-foreground hover:underline"
							onclick={() => onOpenDay(day.date)}
						>
							{`${weekdayShort(day.date)} ${day.date.slice(8, 10)}`}
						</button>
					</td>
					<td class="py-1.5 pr-2 font-medium">
						<button type="button" class="hover:underline" onclick={() => onOpenDay(day.date)}>
							{displayTypeLabel(day.displayType)}
						</button>
					</td>
					<td class="py-1.5 pr-2">
						{#if editingDate === day.date}
							<form method="POST" action="?/saveDay" use:enhance class="flex items-center gap-1.5">
								<input type="hidden" name="date" value={day.date} />
								<input type="hidden" name="kind" value="work" />
								<input type="hidden" name="officeId" value="" />
								<input
									type="hidden"
									name="blocks"
									value={JSON.stringify([
										{ start: editStart, end: editEnd, breakMinutes: day.blocks[0].breakMinutes }
									])}
								/>
								<input
									type="time"
									bind:value={editStart}
									class="h-7 w-24 rounded border border-input px-1 text-sm tabular"
								/>
								<span class="text-muted-foreground">–</span>
								<input
									type="time"
									bind:value={editEnd}
									class="h-7 w-24 rounded border border-input px-1 text-sm tabular"
								/>
								<Button type="submit" size="sm">Save</Button>
								<Button type="button" variant="ghost" size="sm" onclick={cancelInlineEdit}
									>Cancel</Button
								>
							</form>
						{:else}
							<button
								type="button"
								class="text-left tabular hover:underline disabled:pointer-events-none disabled:opacity-0"
								disabled={!canEditInline(day)}
								aria-label={canEditInline(day)
									? `Edit time block ${day.blocks[0].start}–${day.blocks[0].end}`
									: 'No time set'}
								onclick={() => startInlineEdit(day)}
							>
								{day.blocks.length === 1 ? `${day.blocks[0].start}–${day.blocks[0].end}` : ''}
							</button>
						{/if}
					</td>
					<td class="py-1.5 pr-2 text-right tabular">
						{day.homeMinutes > 0 ? `${formatHours(day.homeMinutes)} h` : ''}
					</td>
					<td class="py-1.5">
						{#if day.source === 'prefill' || day.status === 'ghost'}
							<Sparkles
								class="size-3.5 text-muted-foreground"
								aria-hidden="true"
								title="From schedule"
							/>
							<span class="sr-only">From schedule</span>
						{/if}
						{#if day.notes}
							<NotebookPen class="size-3.5 text-muted-foreground" aria-hidden="true" />
							<span class="sr-only">Has a note</span>
						{/if}
					</td>
				</tr>
			{/each}
		{/each}
	</tbody>
</table>

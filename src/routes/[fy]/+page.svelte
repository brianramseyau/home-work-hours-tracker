<script lang="ts">
	import { pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { innerWidth } from 'svelte/reactivity/window';
	import * as Drawer from '$lib/components/ui/drawer';
	import * as Sheet from '$lib/components/ui/sheet';
	import DayEditor from '$lib/components/app/DayEditor.svelte';
	import DiaryTable from '$lib/components/app/DiaryTable.svelte';
	import MarkRangeDialog from '$lib/components/app/MarkRangeDialog.svelte';
	import PunchStrip from '$lib/components/app/PunchStrip.svelte';
	import SummaryPanel from '$lib/components/app/SummaryPanel.svelte';
	import WeekPager from '$lib/components/app/WeekPager.svelte';
	import { formatFullDate } from '$lib/core/date';
	import { groupDiaryDaysByWeek } from '$lib/core/diary';
	import { weekOfFy } from '$lib/core/fy';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const weeks = $derived(groupDiaryDaysByWeek(data.days));
	const currentWeek = $derived(weekOfFy(data.today));
	const isDesktop = $derived((innerWidth.current ?? 0) >= 1024);

	const openDate = $derived((page.state as { dayDate?: string }).dayDate ?? null);
	const openDay = $derived(
		openDate ? (data.days.find((day) => day.date === openDate) ?? null) : null
	);

	function openEditor(date: string) {
		pushState(resolve('/[fy]/day/[date]', { fy: data.fy.slug, date }), { dayDate: date });
	}

	function closeEditor() {
		pushState(resolve('/[fy]', { fy: data.fy.slug }), {});
	}
</script>

<svelte:head>
	<title>{`Diary — ${data.fy.label}`}</title>
</svelte:head>

<div class="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-8">
	<div class="flex flex-col gap-4 lg:col-span-2">
		{#if data.finalised}
			<p class="rounded-lg border bg-muted px-3 py-2 text-sm">
				{`${data.fy.label} is finalised.`}
				<a href="/years" class="underline">Unfinalise it</a> to make changes.
			</p>
		{/if}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h1 class="font-display text-2xl font-semibold">{`${data.fy.label} diary`}</h1>
			<MarkRangeDialog today={data.today} finalised={data.finalised} />
		</div>
		<PunchStrip days={data.days} />
	</div>

	<div class="lg:hidden">
		<div class="mb-4">
			<SummaryPanel
				homeMinutes={data.summary.homeMinutes}
				claimCents={data.claimCents}
				rateCentsPerHour={data.year?.rateCentsPerHour ?? null}
			/>
		</div>
		<WeekPager {weeks} {currentWeek} offices={data.offices} onOpenDay={openEditor} />
	</div>

	<div class="hidden lg:block">
		<DiaryTable {weeks} offices={data.offices} onOpenDay={openEditor} finalised={data.finalised} />
	</div>

	<aside class="hidden lg:sticky lg:top-6 lg:block" aria-label="Summary">
		<SummaryPanel
			homeMinutes={data.summary.homeMinutes}
			claimCents={data.claimCents}
			rateCentsPerHour={data.year?.rateCentsPerHour ?? null}
		/>
	</aside>
</div>

{#if openDay}
	{#if isDesktop}
		<Sheet.Root open={true} onOpenChange={(next) => !next && closeEditor()}>
			<Sheet.Content>
				<Sheet.Header>
					<Sheet.Title>{formatFullDate(openDay.date)}</Sheet.Title>
				</Sheet.Header>
				<div class="px-4">
					{#key openDay.date}
						<DayEditor
							day={openDay}
							offices={data.offices.filter((office) => !office.archivedAt)}
							standard={{
								start: data.settings.standardStart,
								end: data.settings.standardEnd,
								breakMinutes: data.settings.standardBreakMinutes
							}}
							finalised={data.finalised}
							onSaved={closeEditor}
						/>
					{/key}
				</div>
			</Sheet.Content>
		</Sheet.Root>
	{:else}
		<Drawer.Root open={true} onOpenChange={(next) => !next && closeEditor()}>
			<Drawer.Content>
				<Drawer.Header>
					<Drawer.Title>{formatFullDate(openDay.date)}</Drawer.Title>
				</Drawer.Header>
				<div class="px-4 pb-6">
					{#key openDay.date}
						<DayEditor
							day={openDay}
							offices={data.offices.filter((office) => !office.archivedAt)}
							standard={{
								start: data.settings.standardStart,
								end: data.settings.standardEnd,
								breakMinutes: data.settings.standardBreakMinutes
							}}
							finalised={data.finalised}
							onSaved={closeEditor}
						/>
					{/key}
				</div>
			</Drawer.Content>
		</Drawer.Root>
	{/if}
{/if}

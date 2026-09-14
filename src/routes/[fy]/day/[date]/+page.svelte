<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Button } from '$lib/components/ui/button';
	import DayEditor from '$lib/components/app/DayEditor.svelte';
	import { formatFullDate } from '$lib/core/date';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const pageTitle = $derived(`${formatFullDate(data.day.date)} — ${data.fy.label}`);
</script>

<svelte:head>
	<title>{`${pageTitle}`}</title>
</svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6">
	<Button href={`/${data.fy.slug}`} variant="ghost" size="sm" class="self-start">
		<ChevronLeft class="size-4" />
		{`Back to ${data.fy.label}`}
	</Button>
	<h1 class="font-display text-2xl font-semibold">{formatFullDate(data.day.date)}</h1>
	<DayEditor
		day={data.day}
		offices={data.offices.filter((office) => !office.archivedAt)}
		standard={{
			start: data.settings.standardStart,
			end: data.settings.standardEnd,
			breakMinutes: data.settings.standardBreakMinutes
		}}
		finalised={Boolean(data.year?.finalisedAt)}
	/>
</div>

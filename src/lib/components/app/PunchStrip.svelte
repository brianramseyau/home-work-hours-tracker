<script lang="ts">
	import TypeSwatch from './TypeSwatch.svelte';
	import { isUpcoming, type DiaryDay } from '$lib/core/diary';

	let { days }: { days: DiaryDay[] } = $props();
</script>

<!-- A slim, whole-FY-at-a-glance version of the punch card (DESIGN.md). Purely a visual
     preview — every day here also appears, accessibly, in the rows below. -->
<div class="flex gap-[2px] overflow-x-auto pb-1" aria-hidden="true">
	{#each days as day (day.date)}
		<TypeSwatch type={day.displayType} future={isUpcoming(day)} class="h-6 w-1.5 shrink-0" />
	{/each}
</div>

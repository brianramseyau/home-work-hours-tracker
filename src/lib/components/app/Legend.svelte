<script lang="ts">
	import TypeSwatch from './TypeSwatch.svelte';
	import { displayTypeLabel, DISPLAY_TYPES } from '$lib/core/dayType';
</script>

<ul class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
	{#each DISPLAY_TYPES as type (type)}
		<li class="flex items-center gap-1.5">
			<TypeSwatch {type} class="size-3" />
			<span>{displayTypeLabel(type)}</span>
		</li>
	{/each}
</ul>

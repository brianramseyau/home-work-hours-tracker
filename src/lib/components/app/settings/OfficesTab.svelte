<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import OfficeRow from './OfficeRow.svelte';

	interface OfficeData {
		id: number;
		name: string;
		address: string | null;
		archivedAt: string | null;
	}

	let { offices }: { offices: OfficeData[] } = $props();
</script>

<div class="max-w-lg">
	{#if offices.length === 0}
		<p class="text-sm text-muted-foreground">
			Add the places you work from when you're not at home.
		</p>
	{:else}
		<div>
			{#each offices as office (office.id)}
				<OfficeRow {office} />
			{/each}
		</div>
	{/if}

	<form
		method="POST"
		action="?/officeCreate"
		use:enhance
		class="mt-6 flex flex-wrap items-end gap-3"
	>
		<div class="flex flex-col gap-1">
			<Label for="new-office-name">Name</Label>
			<Input id="new-office-name" name="name" placeholder="Office Location 1" class="w-56" />
		</div>
		<div class="flex flex-col gap-1">
			<Label for="new-office-address">Address (optional)</Label>
			<Input id="new-office-address" name="address" class="w-64" />
		</div>
		<Button type="submit">Add office</Button>
	</form>
</div>

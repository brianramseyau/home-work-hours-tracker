<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tabs from '$lib/components/ui/tabs';
	import GeneralTab from '$lib/components/app/settings/GeneralTab.svelte';
	import HolidaysTab from '$lib/components/app/settings/HolidaysTab.svelte';
	import OfficesTab from '$lib/components/app/settings/OfficesTab.svelte';
	import ScheduleTab from '$lib/components/app/settings/ScheduleTab.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const activeOffices = $derived(data.offices.filter((office) => !office.archivedAt));

	let activeTab = $state('general');
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<div class="max-w-3xl">
	<h1 class="font-display text-2xl font-semibold">Settings</h1>

	<Tabs.Root bind:value={activeTab} class="mt-6">
		<!-- text-muted-foreground overrides the vendored default (text-foreground/60), which falls
		     short of WCAG AA contrast against this app's --muted tab-list background. -->
		<Tabs.List>
			<Tabs.Trigger value="general" class="text-muted-foreground">General</Tabs.Trigger>
			<Tabs.Trigger value="offices" class="text-muted-foreground">Offices</Tabs.Trigger>
			<Tabs.Trigger value="schedule" class="text-muted-foreground">Schedule</Tabs.Trigger>
			<Tabs.Trigger value="holidays" class="text-muted-foreground">Holidays</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="general" class="pt-6">
			<GeneralTab settings={data.settings} />
		</Tabs.Content>

		<Tabs.Content value="offices" class="pt-6">
			<OfficesTab offices={data.offices} />
		</Tabs.Content>

		<Tabs.Content value="schedule" class="pt-6">
			<ScheduleTab
				schedules={data.schedules}
				offices={activeOffices}
				includeWeekends={data.settings.includeWeekends}
				today={data.today}
			/>
		</Tabs.Content>

		<Tabs.Content value="holidays" class="pt-6">
			<HolidaysTab holidays={data.holidays} fy={data.holidayFy} />
		</Tabs.Content>
	</Tabs.Root>

	<div class="mt-10 max-w-lg rounded-lg border p-4">
		<h2 class="font-display font-semibold">Historical import</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Bring in years you already tracked in a spreadsheet. You'll review everything before it's
			saved.
		</p>
		<Button variant="outline" disabled class="mt-3">Import a spreadsheet</Button>
	</div>
</div>

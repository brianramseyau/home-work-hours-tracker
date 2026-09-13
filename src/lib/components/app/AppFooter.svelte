<script lang="ts">
	import { APP_NAME, REPO_URL } from '$lib/branding';

	let { version }: { version: string } = $props();
</script>

<footer class="text-xs leading-relaxed text-muted-foreground">
	<p><span>{APP_NAME}</span> <span data-numeric>{version}</span></p>
	<a
		href={REPO_URL}
		target="_blank"
		rel="noreferrer"
		class="underline underline-offset-4 hover:text-foreground"
	>
		Source code on GitHub
	</a>
</footer>

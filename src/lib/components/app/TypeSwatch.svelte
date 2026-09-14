<script lang="ts">
	import type { DisplayType } from '$lib/core/dayType';

	let {
		type,
		future = false,
		class: className = ''
	}: { type: DisplayType; future?: boolean; class?: string } = $props();

	// See foundational/DESIGN.md → "Status is never shown by colour alone": every type pairs a
	// brand colour with a pattern-* utility (layout.css), so the punch card still reads correctly
	// in greyscale or under colour-blindness.
	const PATTERN: Record<DisplayType, string> = {
		home: 'pattern-solid',
		office: 'pattern-outline',
		split: 'pattern-split',
		leave: 'pattern-hatch',
		sick: 'pattern-dots',
		public_holiday: 'pattern-ring',
		off: 'border border-dashed border-border'
	};
	const SWATCH: Record<DisplayType, string> = {
		home: 'var(--lamp)',
		office: 'var(--slate)',
		split: 'var(--lamp)',
		leave: 'var(--heather)',
		sick: 'var(--rosehip)',
		public_holiday: 'var(--gum)',
		off: 'transparent'
	};
</script>

<span
	class={`inline-block rounded-[3px] ${future ? 'pattern-hatch opacity-30' : PATTERN[type]} ${className}`}
	style={`--swatch: ${future ? 'var(--muted-foreground)' : SWATCH[type]}`}
	aria-hidden="true"
></span>

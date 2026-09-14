// The shared shape of a day record, and the display type derived from it. `kind` and `source`
// mirror the `days`/`home_blocks` schema exactly (see schema.ts); this module has no DB import,
// so server and client code share one definition of what a "day" is.

export type DayKind = 'work' | 'leave' | 'sick' | 'public_holiday' | 'off';
export type DaySource = 'prefill' | 'manual' | 'import';

export interface HomeBlock {
	start: string; // HH:mm
	end: string; // HH:mm
	breakMinutes: number;
}

export interface Day {
	date: string; // ISO YYYY-MM-DD
	kind: DayKind;
	officeId: number | null;
	notes: string | null;
	source: DaySource;
	blocks: HomeBlock[];
}

/**
 * The type shown in the punch card and diary rows. A `work` day is **Home** (blocks, no
 * office), **Office** (an office, no blocks) or **Split** (both). The other kinds pass through
 * unchanged. A `work` day with neither blocks nor an office is not a state the app writes, but
 * it displays as `off` rather than throwing.
 */
export type DisplayType = 'home' | 'office' | 'split' | Exclude<DayKind, 'work'>;

export function displayType(day: Pick<Day, 'kind' | 'officeId' | 'blocks'>): DisplayType {
	if (day.kind !== 'work') return day.kind;
	const hasBlocks = day.blocks.length > 0;
	const hasOffice = day.officeId !== null;
	if (hasBlocks && hasOffice) return 'split';
	if (hasBlocks) return 'home';
	if (hasOffice) return 'office';
	return 'off';
}

const DISPLAY_TYPE_LABELS: Record<DisplayType, string> = {
	home: 'Home',
	office: 'Office',
	split: 'Split',
	leave: 'Leave',
	sick: 'Sick',
	public_holiday: 'Public holiday',
	off: 'Off'
};

/** Every display type, in the order shown in the legend and the day-type breakdown. */
export const DISPLAY_TYPES = Object.keys(DISPLAY_TYPE_LABELS) as DisplayType[];

/** The label shown in the punch card, the legend and the day editor's kind toggle. */
export function displayTypeLabel(type: DisplayType): string {
	return DISPLAY_TYPE_LABELS[type];
}

// Pure time-of-day and duration helpers. Times are `HH:mm` text; durations are integer minutes.
// No floats for hours anywhere — `formatHours` is presentation-only, formatting a minute count.

const HH_MM = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

export interface ParsedTime {
	hours: number;
	minutes: number;
}

export function parseHm(hm: string): ParsedTime {
	const match = HH_MM.exec(hm);
	if (!match) throw new Error(`Expected a time in HH:mm format, got "${hm}"`);
	return { hours: Number(match[1]), minutes: Number(match[2]) };
}

/** Minutes since midnight. */
export function toMinutes(hm: string): number {
	const { hours, minutes } = parseHm(hm);
	return hours * 60 + minutes;
}

export function formatHm(hm: { hours: number; minutes: number }): string {
	return `${String(hm.hours).padStart(2, '0')}:${String(hm.minutes).padStart(2, '0')}`;
}

/** Formats a minute count as "7h 36m" (the trailing "0m" is omitted). */
export function formatMinutesAsHm(totalMinutes: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Formats a minute count as decimal hours, e.g. 456 → "7.6". */
export function formatHours(totalMinutes: number): string {
	return (totalMinutes / 60).toFixed(1);
}

export interface TimeBlockInput {
	start: string; // HH:mm
	end: string; // HH:mm
	breakMinutes: number;
}

/** A time block's error, or null when it's valid. */
export function validateBlock(block: TimeBlockInput): string | null {
	const start = toMinutes(block.start);
	const end = toMinutes(block.end);
	if (end <= start) return 'End time must be after start time';
	if (block.breakMinutes < 0) return 'Break cannot be negative';
	if (block.breakMinutes >= end - start) return 'Break must be shorter than the time block';
	return null;
}

/** The block's worked minutes (span minus break). Throws if the block is invalid. */
export function blockMinutes(block: TimeBlockInput): number {
	const error = validateBlock(block);
	if (error) throw new Error(error);
	return toMinutes(block.end) - toMinutes(block.start) - block.breakMinutes;
}

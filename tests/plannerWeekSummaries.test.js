import { describe, expect, it } from 'vitest';
import { buildPlannerWeekSummaries, getWeekCompletionTone } from '../src/views/Planner';

function createPlannerProject(overrides = {}) {
    return {
        id: 'project-1',
        title: 'Projekt',
        done: false,
        contractor: '',
        priority: 'Normal',
        createdAt: 1710000000000,
        createdBy: 'admin@example.com',
        week: '2026-W17',
        address: '',
        phone: '',
        notes: '',
        ...overrides
    };
}

describe('planner week summaries', () => {
    it('shows old weeks only when they contain data, while keeping current and future weeks visible', () => {
        const summaries = buildPlannerWeekSummaries([
            createPlannerProject({ id: 'past-1', week: '2026-W15' }),
            createPlannerProject({ id: 'future-1', week: '2026-W21' })
        ], new Date('2026-04-22T12:00:00.000Z'));

        expect(summaries.some((summary) => summary.week === '2026-W15')).toBe(true);
        expect(summaries.some((summary) => summary.week === '2026-W16')).toBe(false);
        expect(summaries.some((summary) => summary.week === '2026-W17')).toBe(true);
        expect(summaries.some((summary) => summary.week === '2026-W25')).toBe(true);
    });

    it('builds per-week counts and completion ratios for badge summaries', () => {
        const summaries = buildPlannerWeekSummaries([
            createPlannerProject({ id: 'green-1', week: '2026-W15', done: true }),
            createPlannerProject({ id: 'green-2', week: '2026-W15', done: true }),
            createPlannerProject({ id: 'green-3', week: '2026-W15', done: true }),
            ...Array.from({ length: 10 }, (_, index) => createPlannerProject({
                id: `yellow-${index}`,
                week: '2026-W18',
                done: index < 4
            })),
            ...Array.from({ length: 10 }, (_, index) => createPlannerProject({
                id: `red-${index}`,
                week: '2026-W19',
                done: index < 3
            }))
        ], new Date('2026-04-22T12:00:00.000Z'));

        const greenWeek = summaries.find((summary) => summary.week === '2026-W15');
        const yellowWeek = summaries.find((summary) => summary.week === '2026-W18');
        const redWeek = summaries.find((summary) => summary.week === '2026-W19');

        expect(greenWeek).toMatchObject({ totalCount: 3, doneCount: 3, completionRatio: 1 });
        expect(yellowWeek).toMatchObject({ totalCount: 10, doneCount: 4, completionRatio: 0.4 });
        expect(redWeek).toMatchObject({ totalCount: 10, doneCount: 3, completionRatio: 0.3 });
    });

    it('returns the expected tone for week badge thresholds', () => {
        expect(getWeekCompletionTone({ totalCount: 0, completionRatio: 0 })).toBeNull();
        expect(getWeekCompletionTone({ totalCount: 3, completionRatio: 1 })).toBe('success');
        expect(getWeekCompletionTone({ totalCount: 10, completionRatio: 0.4 })).toBe('warning');
        expect(getWeekCompletionTone({ totalCount: 10, completionRatio: 0.3 })).toBe('danger');
        expect(getWeekCompletionTone({ totalCount: 10, completionRatio: 0 })).toBe('danger');
    });
});

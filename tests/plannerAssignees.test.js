import { describe, expect, it } from 'vitest';
import {
    PLANNER_ASSIGNEE_OPTIONS,
    addPlannerAssignee,
    normalizePlannerAssignees,
    normalizePlannerProject,
    removePlannerAssignee
} from '../src/views/Planner';

describe('planner assignees', () => {
    it('normalizes allowed assignees, lowercases them, and removes duplicates', () => {
        expect(normalizePlannerAssignees([
            ' Johan@brixx.se ',
            'info@brixx.se',
            'INFO@BRIXX.SE',
            'outsider@example.com',
            42
        ])).toEqual([
            'johan@brixx.se',
            'info@brixx.se'
        ]);
    });

    it('adds only valid unique assignees and removes assignees cleanly', () => {
        const withJohan = addPlannerAssignee([], 'johan@brixx.se');
        const withDuplicateJohan = addPlannerAssignee(withJohan, 'Johan@brixx.se');
        const withErik = addPlannerAssignee(withDuplicateJohan, 'erik@brixx.se');
        const withInvalid = addPlannerAssignee(withErik, 'nobody@example.com');

        expect(withInvalid).toEqual(['johan@brixx.se', 'erik@brixx.se']);
        expect(removePlannerAssignee(withInvalid, 'JOHAN@BRIXX.SE')).toEqual(['erik@brixx.se']);
    });

    it('hydrates old planner documents without assignees to an empty list', () => {
        const project = normalizePlannerProject({
            id: 'project-1',
            data: () => ({
                title: 'Projekt',
                done: false,
                contractor: '',
                priority: 'Normal',
                createdAt: 1710000000000,
                createdBy: 'admin@example.com',
                week: '2026-W17',
                address: '',
                phone: '',
                notes: ''
            })
        });

        expect(project.assignees).toEqual([]);
    });

    it('keeps the fixed assignee roster stable', () => {
        expect(PLANNER_ASSIGNEE_OPTIONS.map((option) => option.email)).toEqual([
            'johan@brixx.se',
            'info@brixx.se',
            'erik@brixx.se'
        ]);
    });
});

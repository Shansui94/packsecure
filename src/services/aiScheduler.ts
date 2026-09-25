import { JobOrder, Lorry } from '../types';

interface DispatchPlan {
    jobId: string;
    suggestedLorryId: string;
    confidenceScore: number;
    reason: string;
}

export const generateDispatchPlan = (jobs: JobOrder[], lorries: Lorry[]): DispatchPlan[] => {
    const plan: DispatchPlan[] = [];

    // 1. Filter for Pending Deliveries
    // We only care about jobs that are 'Completed' (production done) but not yet 'Delivered'
    // And ideally not yet assigned (driverId is empty), OR we can re-optimize assigned ones (shadow mode)
    const pendingJobs = jobs.filter(j =>
        (j.status === 'Completed' || j.Status === 'Completed') &&
        (!j.deliveryStatus || j.deliveryStatus === 'Pending') &&
        !j.driverId // Only shadow unassigned jobs for v1
    );

    // 2. Iterate and Match
    pendingJobs.forEach(job => {
        const zone = job.deliveryZone || 'Unknown';

        // Strategy A: Zone Match (High Confidence)
        const perfectMatch = lorries.find(l =>
            l.preferredZone === zone &&
            l.status === 'Available'
        );

        if (perfectMatch) {
            plan.push({
                jobId: job.Job_ID || '',
                suggestedLorryId: perfectMatch.id,
                confidenceScore: 0.95,
                reason: `Perfect Zone Match (${zone})`
            });
            return;
        }

        // Strategy B: Any Available Driver (Low Confidence)
        const anyDriver = lorries.find(l => l.status === 'Available');
        if (anyDriver) {
            plan.push({
                jobId: job.Job_ID || '',
                suggestedLorryId: anyDriver.id,
                confidenceScore: 0.6,
                reason: `Backfill: Driver Available (Pref: ${anyDriver.preferredZone})`
            });
        }
    });

    return plan;
};

export const calculateSavings = (plan: DispatchPlan[]): string => {
    // Mock metric for the dashboard
    if (plan.length === 0) return "0 km";
    const saved = plan.filter(p => p.confidenceScore > 0.9).length * 15; // Assume 15km saved per efficient match
    return `${saved} km`;
};

import {
  addMonths,
  defaultDeadline,
  endOfDayBrasilia,
  extensionBlockReason,
  suggestedExtensionDeadline,
} from './deadline-logic';

const NOW = new Date('2026-10-19T12:00:00Z').getTime();
const PAST = '2026-10-01T15:00:00.000Z';
const FUTURE = '2026-12-01T15:00:00.000Z';

describe('addMonths', () => {
  it('clamps to the last day of a shorter month', () => {
    expect(addMonths('2026-08-31T10:00:00.000Z', 6)).toBe(
      '2027-02-28T10:00:00.000Z',
    );
  });

  it('keeps the day when the target month has it', () => {
    expect(addMonths('2026-03-15T10:00:00.000Z', 3)).toBe(
      '2026-06-15T10:00:00.000Z',
    );
  });
});

describe('defaultDeadline', () => {
  it('adds the configured duration to the registration date', () => {
    expect(defaultDeadline('2026-04-10T09:30:00.000Z', 6)).toBe(
      '2026-10-10T09:30:00.000Z',
    );
  });
});

describe('endOfDayBrasilia', () => {
  it('maps a date to the end of that day in UTC-3', () => {
    expect(endOfDayBrasilia('2027-01-15')).toBe('2027-01-16T02:59:59.999Z');
  });
});

describe('suggestedExtensionDeadline', () => {
  it('adds three months to the expired deadline', () => {
    expect(suggestedExtensionDeadline(PAST, NOW, 3)).toBe(
      '2027-01-01T15:00:00.000Z',
    );
  });

  it('counts from today when deadline + 3 months is already in the past', () => {
    expect(suggestedExtensionDeadline('2026-06-01T15:00:00.000Z', NOW, 3)).toBe(
      '2027-01-19T12:00:00.000Z',
    );
  });
});

describe('extensionBlockReason', () => {
  const base = {
    now: NOW,
    deadlineAt: PAST,
    journeyCompleted: false,
    requests: [],
  };

  it('allows a request once the deadline expired', () => {
    expect(extensionBlockReason(base)).toBeNull();
  });

  it('blocks while the deadline has not expired', () => {
    expect(extensionBlockReason({ ...base, deadlineAt: FUTURE })).toBe(
      'not_expired',
    );
  });

  it('blocks when the journey is already completed', () => {
    expect(extensionBlockReason({ ...base, journeyCompleted: true })).toBe(
      'journey_completed',
    );
  });

  it('blocks a second request while one is pending', () => {
    expect(
      extensionBlockReason({
        ...base,
        requests: [{ status: 'pending', previous_deadline_at: PAST }],
      }),
    ).toBe('already_requested');
  });

  it('blocks a new request for a deadline whose request was rejected', () => {
    expect(
      extensionBlockReason({
        ...base,
        requests: [{ status: 'rejected', previous_deadline_at: PAST }],
      }),
    ).toBe('already_requested');
  });

  it('allows a new request after a rejection if the admin changed the deadline', () => {
    expect(
      extensionBlockReason({
        ...base,
        requests: [
          { status: 'rejected', previous_deadline_at: '2026-09-01T00:00:00Z' },
        ],
      }),
    ).toBeNull();
  });

  it('blocks once the approved extension limit is reached', () => {
    expect(
      extensionBlockReason({
        ...base,
        requests: [
          { status: 'approved', previous_deadline_at: '2026-07-01T00:00:00Z' },
        ],
      }),
    ).toBe('limit_reached');
  });
});

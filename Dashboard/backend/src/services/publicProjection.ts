type Row = Record<string, any>;

function asRow(value: unknown): Row | undefined {
  return value && typeof value === 'object' ? value as Row : undefined;
}

function pick(value: unknown, fields: readonly string[]): Row | null {
  const row = asRow(value);
  if (!row) return value == null ? null : { _id: String(value) };
  const result: Row = {};
  for (const key of fields) {
    if (row[key] !== undefined) result[key] = row[key];
  }
  return result;
}

export function projectMachine(value: unknown): Row | null {
  const row = asRow(value);
  if (!row) return value == null ? null : { _id: String(value) };
  const machine = pick(row, ['_id', 'machineCode', 'name', 'locationName', 'locationType', 'status', 'lastSeenAt', 'lastHeartbeatAt', 'totalSessions', 'latitude', 'longitude', 'createdAt', 'updatedAt'])!;
  if (Array.isArray(row.bins)) {
    machine.bins = row.bins.map((bin: unknown) => pick(bin, ['binType', 'capacityPercent']));
  }
  return machine;
}

export function projectSession(value: unknown): Row | null {
  const row = asRow(value);
  if (!row) return value == null ? null : { _id: String(value) };
  const session = pick(row, ['_id', 'sessionCode', 'machineName', 'items', 'totalItems', 'totalPoints', 'status', 'claimedAt', 'expiresAt', 'createdAt', 'updatedAt'])!;
  if (Array.isArray(row.items)) {
    session.items = row.items.map((item: unknown) => pick(item, ['itemType', 'quantity', 'pointsPerItem', 'avgConfidence']));
  }
  if (row.machineId !== undefined) {
    const machine = asRow(row.machineId);
    session.machineId = machine && ('machineCode' in machine || 'name' in machine)
      ? projectMachine(machine)
      : typeof machine?.toHexString === 'function' ? machine.toHexString() : row.machineId;
  }
  if (row.claimedBy !== undefined) {
    const claimant = asRow(row.claimedBy);
    session.claimedBy = claimant && ('displayName' in claimant || 'avatar' in claimant)
      ? pick(claimant, ['_id', 'displayName', 'avatar'])
      : typeof claimant?.toHexString === 'function' ? claimant.toHexString() : row.claimedBy;
  }
  return session;
}

export function projectUser(value: unknown): Row | null {
  const row = asRow(value);
  if (!row) return value == null ? null : { _id: String(value) };
  const user = pick(row, ['_id', 'displayName', 'avatar', 'role', 'className', 'membershipTier', 'totalPoints', 'lifetimeEarnedPoints', 'lifetimeRedeemedPoints', 'totalItems', 'currentStreak', 'longestStreak', 'lastContributionAt', 'createdAt', 'updatedAt'])!;
  if (row.totals !== undefined) user.totals = pick(row.totals, ['pet_clean', 'pet_bad', 'aluminum', 'points']);
  return user;
}

export function projectDetection(value: unknown): Row | null {
  return pick(value, ['_id', 'eventId', 'machineId', 'machineCode', 'detectedType', 'confidence', 'fps', 'latencyMs', 'snapshotUrl', 'sortingStatus', 'syncStatus', 'capturedAt', 'createdAt', 'updatedAt']);
}

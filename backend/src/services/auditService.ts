import { Types } from 'mongoose';
import { AuditEntityType, UserRole } from '../constants/domain';
import { AuditLog } from '../models';

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'identifyingProof',
  'identifyingDetails',
  'explanation'
]);

function stripSensitive(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (REDACTED_KEYS.has(key)) continue;
    safe[key] = value;
  }
  return safe;
}

export interface AuditEntryInput {
  actorId: string | Types.ObjectId;
  actorRole: UserRole;
  action: string;
  entityType: AuditEntityType;
  entityId: string | Types.ObjectId;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(input: AuditEntryInput): Promise<void> {
  await AuditLog.create({
    actor: new Types.ObjectId(input.actorId),
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: new Types.ObjectId(input.entityId),
    summary: input.summary.slice(0, 300),
    metadata: stripSensitive(input.metadata)
  });
}

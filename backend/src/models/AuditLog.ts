import mongoose, { Document, Schema, Types } from 'mongoose';
import { AUDIT_ENTITY_TYPES, AuditEntityType, USER_ROLES, UserRole } from '../constants/domain';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor: Types.ObjectId;
  actorRole: UserRole;
  action: string;
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    actorRole: {
      type: String,
      enum: USER_ROLES,
      required: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    entityType: {
      type: String,
      enum: AUDIT_ENTITY_TYPES,
      required: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

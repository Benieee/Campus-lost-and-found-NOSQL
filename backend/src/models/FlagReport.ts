import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  FLAG_REPORT_REASONS,
  FLAG_REPORT_STATUSES,
  FLAG_REPORT_TARGETS,
  FlagReportReason,
  FlagReportStatus,
  FlagReportTarget
} from '../constants/domain';

export interface IFlagReport extends Document {
  _id: Types.ObjectId;
  targetType: FlagReportTarget;
  targetId: Types.ObjectId;
  targetLabel: string;
  reason: FlagReportReason;
  details: string;
  reportedBy: Types.ObjectId;
  status: FlagReportStatus;
  resolutionNotes: string;
  actionTaken: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const flagReportSchema = new Schema<IFlagReport>(
  {
    targetType: {
      type: String,
      enum: FLAG_REPORT_TARGETS,
      required: true
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    targetLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    reason: {
      type: String,
      enum: FLAG_REPORT_REASONS,
      required: true
    },
    details: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1200
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: FLAG_REPORT_STATUSES,
      default: 'Open',
      required: true
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1200
    },
    actionTaken: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

flagReportSchema.index({ status: 1, createdAt: -1 });
flagReportSchema.index({ targetType: 1, targetId: 1 });
flagReportSchema.index({ reportedBy: 1, createdAt: -1 });

export const FlagReport = mongoose.model<IFlagReport>('FlagReport', flagReportSchema);

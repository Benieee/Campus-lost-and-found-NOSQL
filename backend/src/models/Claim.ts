import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  CLAIM_STATUSES,
  CLAIM_VERIFICATION_METHODS,
  ClaimStatus,
  ClaimVerificationMethod
} from '../constants/domain';

export interface IClaim extends Document {
  _id: Types.ObjectId;
  referenceCode: string;
  claimant: Types.ObjectId;
  foundItem: Types.ObjectId;
  linkedLostItem?: Types.ObjectId;
  explanation: string;
  identifyingProof: string;
  status: ClaimStatus;
  verificationMethod?: ClaimVerificationMethod;
  evidenceVerified: boolean;
  decisionReason: string;
  outcome: string;
  verificationNotes: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const claimSchema = new Schema<IClaim>(
  {
    referenceCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    claimant: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    foundItem: {
      type: Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: true
    },
    linkedLostItem: {
      type: Schema.Types.ObjectId,
      ref: 'LostItem'
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1500
    },
    identifyingProof: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1200
    },
    status: {
      type: String,
      enum: CLAIM_STATUSES,
      default: 'Pending',
      required: true
    },
    verificationMethod: {
      type: String,
      enum: CLAIM_VERIFICATION_METHODS
    },
    evidenceVerified: {
      type: Boolean,
      default: false,
      required: true
    },
    decisionReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 600
    },
    outcome: {
      type: String,
      trim: true,
      default: '',
      maxlength: 600
    },
    verificationNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1500
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

claimSchema.index({ referenceCode: 1 }, { unique: true });
claimSchema.index({ claimant: 1, createdAt: -1 });
claimSchema.index({ foundItem: 1, status: 1 });
claimSchema.index({ status: 1, createdAt: -1 });
claimSchema.index(
  { claimant: 1, foundItem: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['Pending', 'Under Review'] } }
  }
);

export const Claim = mongoose.model<IClaim>('Claim', claimSchema);

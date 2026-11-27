import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  CUSTODY_EVENT_TYPES,
  CustodyEventType,
  FOUND_ITEM_STATUSES,
  FoundItemStatus,
  ITEM_CATEGORIES,
  ItemCategory,
  LISTING_MODERATION_STATUSES,
  ListingModerationStatus,
  UNCLAIMED_POLICY_ACTIONS,
  UnclaimedPolicyAction
} from '../constants/domain';

export interface ICustodyEvent {
  eventType: CustodyEventType;
  location: string;
  storageBin?: string;
  recipientName?: string;
  recipientId?: string;
  notes?: string;
  recordedBy?: Types.ObjectId;
  recordedByName?: string;
  timestamp: Date;
}

export interface IFoundItem extends Document {
  _id: Types.ObjectId;
  reporter: Types.ObjectId;
  itemName: string;
  category: ItemCategory;
  description: string;
  identifyingDetails: string;
  locationFound: string;
  locationRef?: Types.ObjectId;
  dateFound: Date;
  holdingLocation: string;
  storageBin?: string;
  imageUrl?: string;
  status: FoundItemStatus;
  moderationStatus: ListingModerationStatus;
  moderationNotes?: string;
  collectedAt?: Date;
  collectedByName?: string;
  collectedById?: string;
  custodyHistory: ICustodyEvent[];
  unclaimedPolicyAction: UnclaimedPolicyAction;
  policyActionDate?: Date;
  policyNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const custodyEventSchema = new Schema<ICustodyEvent>(
  {
    eventType: {
      type: String,
      enum: CUSTODY_EVENT_TYPES,
      required: true
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140
    },
    storageBin: {
      type: String,
      trim: true,
      maxlength: 80
    },
    recipientName: {
      type: String,
      trim: true,
      maxlength: 120
    },
    recipientId: {
      type: String,
      trim: true,
      maxlength: 60
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    recordedByName: {
      type: String,
      trim: true,
      maxlength: 120
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  { _id: false }
);

const foundItemSchema = new Schema<IFoundItem>(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    category: {
      type: String,
      enum: ITEM_CATEGORIES,
      required: true
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1200
    },
    identifyingDetails: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000
    },
    locationFound: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140
    },
    locationRef: {
      type: Schema.Types.ObjectId,
      ref: 'Location'
    },
    dateFound: {
      type: Date,
      required: true
    },
    holdingLocation: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140
    },
    storageBin: {
      type: String,
      trim: true,
      maxlength: 80,
      default: ''
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 500
    },
    status: {
      type: String,
      enum: FOUND_ITEM_STATUSES,
      default: 'Stored',
      required: true
    },
    moderationStatus: {
      type: String,
      enum: LISTING_MODERATION_STATUSES,
      default: 'Approved',
      required: true
    },
    moderationNotes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    collectedAt: {
      type: Date
    },
    collectedByName: {
      type: String,
      trim: true,
      maxlength: 120
    },
    collectedById: {
      type: String,
      trim: true,
      maxlength: 60
    },
    custodyHistory: {
      type: [custodyEventSchema],
      default: []
    },
    unclaimedPolicyAction: {
      type: String,
      enum: UNCLAIMED_POLICY_ACTIONS,
      default: 'None',
      required: true
    },
    policyActionDate: {
      type: Date
    },
    policyNotes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

foundItemSchema.index({ status: 1, createdAt: -1 });
foundItemSchema.index({ moderationStatus: 1, status: 1 });
foundItemSchema.index({ category: 1, status: 1 });
foundItemSchema.index({ reporter: 1, createdAt: -1 });
foundItemSchema.index({ locationFound: 1, status: 1 });
foundItemSchema.index({ dateFound: -1 });
foundItemSchema.index({ itemName: 'text', description: 'text', locationFound: 'text', holdingLocation: 'text' });

export const FoundItem = mongoose.model<IFoundItem>('FoundItem', foundItemSchema);

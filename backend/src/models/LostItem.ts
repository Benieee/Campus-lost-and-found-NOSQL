import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  CONTACT_PREFERENCES,
  ContactPreference,
  ITEM_CATEGORIES,
  ItemCategory,
  LOST_ITEM_STATUSES,
  LostItemStatus
} from '../constants/domain';

export interface ILostItem extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  itemName: string;
  category: ItemCategory;
  description: string;
  identifyingDetails: string;
  lastKnownLocation: string;
  locationRef?: Types.ObjectId;
  dateLost: Date;
  approximateTimeLost: string;
  imageUrl?: string;
  contactPreference: ContactPreference;
  status: LostItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

const lostItemSchema = new Schema<ILostItem>(
  {
    owner: {
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
    lastKnownLocation: {
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
    dateLost: {
      type: Date,
      required: true
    },
    approximateTimeLost: {
      type: String,
      trim: true,
      default: 'Unknown',
      maxlength: 60
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 500
    },
    contactPreference: {
      type: String,
      enum: CONTACT_PREFERENCES,
      default: 'email',
      required: true
    },
    status: {
      type: String,
      enum: LOST_ITEM_STATUSES,
      default: 'Missing',
      required: true
    }
  },
  {
    timestamps: true
  }
);

lostItemSchema.index({ status: 1, createdAt: -1 });
lostItemSchema.index({ category: 1, status: 1 });
lostItemSchema.index({ owner: 1, createdAt: -1 });
lostItemSchema.index({ lastKnownLocation: 1, status: 1 });
lostItemSchema.index({ dateLost: -1 });
lostItemSchema.index({ itemName: 'text', description: 'text', lastKnownLocation: 'text' });

export const LostItem = mongoose.model<ILostItem>('LostItem', lostItemSchema);

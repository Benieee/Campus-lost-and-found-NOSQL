import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  FOUND_ITEM_STATUSES,
  FoundItemStatus,
  ITEM_CATEGORIES,
  ItemCategory
} from '../constants/domain';

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
  imageUrl?: string;
  status: FoundItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

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
    }
  },
  {
    timestamps: true
  }
);

foundItemSchema.index({ status: 1, createdAt: -1 });
foundItemSchema.index({ category: 1, status: 1 });
foundItemSchema.index({ reporter: 1, createdAt: -1 });
foundItemSchema.index({ locationFound: 1, status: 1 });
foundItemSchema.index({ dateFound: -1 });
foundItemSchema.index({ itemName: 'text', description: 'text', locationFound: 'text', holdingLocation: 'text' });

export const FoundItem = mongoose.model<IFoundItem>('FoundItem', foundItemSchema);

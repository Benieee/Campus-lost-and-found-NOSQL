import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILocation extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  buildingArea: string;
  isHoldingDesk: boolean;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ILocation>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20
    },
    buildingArea: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    isHoldingDesk: {
      type: Boolean,
      default: false,
      required: true
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true
    }
  },
  {
    timestamps: true
  }
);

locationSchema.index({ name: 1 }, { unique: true });
locationSchema.index({ code: 1 }, { unique: true });
locationSchema.index({ isActive: 1, isHoldingDesk: 1 });

export const Location = mongoose.model<ILocation>('Location', locationSchema);

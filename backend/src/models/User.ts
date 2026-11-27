import mongoose, { Document, Schema, Types } from 'mongoose';
import { USER_ROLES, UserRole } from '../constants/domain';

export interface IUser extends Document {
  _id: Types.ObjectId;
  studentId: string;
  fullName: string;
  email: string;
  course: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254
    },
    course: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'student',
      required: true
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

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ studentId: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });

export const User = mongoose.model<IUser>('User', userSchema);

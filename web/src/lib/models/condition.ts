import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Admin-managed condition tag (e.g. "Diabetes") and the salts that treat it. */
const conditionSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: {
      en: { type: String, required: true, trim: true },
      hi: { type: String, trim: true },
      mr: { type: String, trim: true },
    },
    salts: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type ConditionDoc = InferSchemaType<typeof conditionSchema> & { _id: mongoose.Types.ObjectId };

export const Condition: Model<ConditionDoc> =
  (mongoose.models.Condition as Model<ConditionDoc>) ?? mongoose.model<ConditionDoc>("Condition", conditionSchema);

import "server-only";
import type mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Membership } from "@/lib/models/membership";
import { Notification, type NotificationKind } from "@/lib/models/notification";
import { can, type MemberRole, type Permission } from "@/lib/permissions";

type Params = Record<string, string | number>;

/**
 * Creates one notification per recipient. Recipients are either explicit
 * users, or every active member of a business who has `permission`.
 */
export async function notify(opts: {
  businessId: mongoose.Types.ObjectId;
  kind: NotificationKind;
  params?: Params;
  link?: string;
  userIds?: string[];
  permission?: Permission;
}) {
  await connectDB();
  let userIds = opts.userIds;
  if (!userIds) {
    const members = await Membership.find({ businessId: opts.businessId, status: "active" }, { userId: 1, role: 1 }).lean();
    userIds = members.filter((m) => !opts.permission || can(m.role as MemberRole, opts.permission)).map((m) => m.userId);
  }
  if (!userIds.length) return;
  await Notification.insertMany(
    userIds.map((userId) => ({
      userId,
      businessId: opts.businessId,
      kind: opts.kind,
      params: opts.params ?? {},
      link: opts.link,
    })),
  );
}

export async function unreadCount(userId: string, businessId: mongoose.Types.ObjectId) {
  await connectDB();
  return Notification.countDocuments({ userId, businessId, readAt: null });
}

export async function listNotifications(userId: string, businessId: mongoose.Types.ObjectId, limit = 50) {
  await connectDB();
  return Notification.find({ userId, businessId }).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function markAllRead(userId: string, businessId: mongoose.Types.ObjectId) {
  await connectDB();
  await Notification.updateMany({ userId, businessId, readAt: null }, { $set: { readAt: new Date() } });
}

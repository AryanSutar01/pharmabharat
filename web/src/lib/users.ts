import "server-only";
import { ObjectId } from "mongodb";
import { mongoDb } from "@/lib/db/mongo";

export type UserSummary = { id: string; name: string; email: string; image?: string | null; platformRole?: string };

/** Reads better-auth's `user` collection (not a mongoose model). */
export async function getUsersByIds(ids: string[]): Promise<Map<string, UserSummary>> {
  const oids = [...new Set(ids)].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!oids.length) return new Map();
  const rows = await mongoDb()
    .collection("user")
    .find({ _id: { $in: oids } }, { projection: { name: 1, email: 1, image: 1, platformRole: 1 } })
    .toArray();
  return new Map(
    rows.map((u) => [
      String(u._id),
      { id: String(u._id), name: u.name, email: u.email, image: u.image, platformRole: u.platformRole },
    ]),
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/session";
import { adminClient } from "@/lib/supabase";
import { deleteWallPost } from "@/lib/wall";

export async function removePost(formData: FormData) {
  const identity = await currentAdmin();
  const postId = String(formData.get("postId") ?? "");
  if (!postId) throw new Error("No post selected.");
  await deleteWallPost(adminClient(), postId, identity.email);
  revalidatePath("/wall");
}

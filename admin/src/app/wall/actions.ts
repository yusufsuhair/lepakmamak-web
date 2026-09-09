"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access";
import { adminClient } from "@/lib/supabase";
import { deleteWallPost } from "@/lib/wall";

export async function removePost(formData: FormData) {
  const token = (await headers()).get("Cf-Access-Jwt-Assertion") ?? "";
  const identity = await requireAdmin(new Request("https://admin.local/", {
    headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
  }));
  const postId = String(formData.get("postId") ?? "");
  if (!postId) throw new Error("No post selected.");
  await deleteWallPost(adminClient(), postId, identity.email);
  revalidatePath("/wall");
}

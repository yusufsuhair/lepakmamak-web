# Admin Console — Foundation and Wall Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed, Access-protected admin console at `admin.lepakmamak.my` that can list and delete any Lepak Wall post, with every deletion written to an audit log.

**Architecture:** A self-contained Next.js app in `admin/`, deployed to Cloudflare Workers via the OpenNext adapter, separate from the game's Pages project. Cloudflare Access fronts the subdomain; the app independently verifies the Access JWT server-side. Data access is Supabase with the service-role key, used only in server code.

**Tech Stack:** Next.js (App Router), `@opennextjs/cloudflare`, `wrangler`, `jose`, `@supabase/supabase-js`, Playwright (existing root runner).

**Spec:** `docs/superpowers/specs/2026-09-09-admin-console-design.md`

## Global Constraints

- Adapter is `@opennextjs/cloudflare` on Cloudflare **Workers**. `@cloudflare/next-on-pages` is deprecated; `vinext` is in beta and is not used for a console with production money access.
- `wrangler` must be `3.99.0` or later.
- `compatibility_flags` must include `nodejs_compat`; `compatibility_date` must be `2024-09-23` or later.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It must never appear in a client component, a `NEXT_PUBLIC_*` variable, or the repo.
- Admin identity is exactly `admin@example.com`. Nothing else is authorised.
- Access JWT header is `Cf-Access-Jwt-Assertion`; JWKS is `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`; issuer is `https://<team>.cloudflareaccess.com`.
- Every destructive action writes one `admin_audit_log` row before returning success.
- Tests live in the existing root `tests/` directory and run with `npm test`.

---

### Task 1: Scaffold the admin app on OpenNext

**Files:**
- Create: `admin/package.json`, `admin/next.config.ts`, `admin/open-next.config.ts`, `admin/wrangler.jsonc`, `admin/tsconfig.json`, `admin/.gitignore`, `admin/src/app/layout.tsx`, `admin/src/app/page.tsx`
- Modify: `.gitignore` (root)

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable Next.js app rooted at `admin/`, previewable with `npm run preview` from inside `admin/`.

- [ ] **Step 1: Create the Next.js app**

```bash
cd /Users/yusufsuhair/Downloads/astra
npx create-next-app@latest admin --typescript --app --src-dir --no-tailwind --eslint --import-alias "@/*"
```

The `@/*` alias is required: Tasks 4 and 5 import `@/lib/supabase`, `@/lib/wall` and
`@/lib/access`. Confirm `admin/tsconfig.json` contains `"paths": { "@/*": ["./src/*"] }`
before moving on.

- [ ] **Step 2: Install the Cloudflare adapter**

```bash
cd admin
npm install @opennextjs/cloudflare@latest
npm install --save-dev wrangler@latest
npx wrangler --version   # must print 3.99.0 or later
```

- [ ] **Step 3: Write `admin/wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "lepakmamak-admin",
  "compatibility_date": "2025-03-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

- [ ] **Step 4: Write `admin/open-next.config.ts`**

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
```

- [ ] **Step 5: Wire dev support in `admin/next.config.ts`**

```typescript
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

initOpenNextCloudflareForDev();

export default nextConfig;
```

- [ ] **Step 6: Add scripts to `admin/package.json`**

Replace the `scripts` block with:

```json
{
  "dev": "next dev",
  "build": "next build",
  "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
  "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
}
```

- [ ] **Step 7: Ignore build output**

Append to `admin/.gitignore`:

```
.open-next
.dev.vars
```

Append to the root `.gitignore`:

```
admin/node_modules
admin/.next
admin/.open-next
admin/.dev.vars
```

- [ ] **Step 8: Replace `admin/src/app/page.tsx` with a placeholder shell**

```tsx
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>LepakMamak admin</h1>
      <p>Console is running.</p>
    </main>
  );
}
```

- [ ] **Step 9: Verify it builds for Workers**

Run: `cd admin && npm run preview`
Expected: the OpenNext build completes and a local Worker preview serves "Console is running." Stop it with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
cd /Users/yusufsuhair/Downloads/astra
git add .gitignore admin
git commit -m "feat: scaffold admin console on Next.js and OpenNext"
```

---

### Task 2: Verify the Cloudflare Access JWT

The Access policy is the authorisation model, but a request that reaches the origin directly carries no Access guarantee. This task makes the app itself reject anything that is not a valid, correctly-audienced token for the one allowed email.

**Files:**
- Create: `admin/src/lib/access.ts`
- Test: `tests/admin-access.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AccessIdentity = { email: string }`
  - `class AccessDenied extends Error`
  - `verifyAccessJwt(token: string, options: VerifyOptions): Promise<AccessIdentity>` where
    `VerifyOptions = { teamDomain: string; aud: string; allowedEmail: string; jwks?: JWTVerifyGetKey }`
  - `requireAdmin(request: Request): Promise<AccessIdentity>`

- [ ] **Step 1: Install jose in the admin app**

```bash
cd admin && npm install jose
```

- [ ] **Step 2: Write the failing test**

Create `tests/admin-access.spec.ts`:

```typescript
import {test,expect} from '@playwright/test';
import {SignJWT,exportJWK,generateKeyPair,createLocalJWKSet} from 'jose';
import {verifyAccessJwt,AccessDenied,requireAdmin} from '../admin/src/lib/access';

const TEAM='lepakmamak', AUD='aud-tag-123', EMAIL='admin@example.com';
const ISS=`https://${TEAM}.cloudflareaccess.com`;

async function harness(){
 const {publicKey,privateKey}=await generateKeyPair('RS256');
 const jwk=await exportJWK(publicKey); jwk.kid='k1'; jwk.alg='RS256';
 const jwks=createLocalJWKSet({keys:[jwk]});
 const sign=(claims:Record<string,unknown>,opts:{iss?:string;aud?:string;exp?:string}={})=>
  new SignJWT(claims)
   .setProtectedHeader({alg:'RS256',kid:'k1'})
   .setIssuer(opts.iss??ISS).setAudience(opts.aud??AUD)
   .setIssuedAt().setExpirationTime(opts.exp??'5m').sign(privateKey);
 return {jwks,sign};
}
const opts=(jwks:any)=>({teamDomain:TEAM,aud:AUD,allowedEmail:EMAIL,jwks});

test('a valid Access token for the admin email is accepted',async()=>{
 const {jwks,sign}=await harness();
 const identity=await verifyAccessJwt(await sign({email:EMAIL}),opts(jwks));
 expect(identity).toEqual({email:EMAIL});
});

test('tokens that are not the admin are rejected',async()=>{
 const {jwks,sign}=await harness();
 await expect(verifyAccessJwt(await sign({email:'someone@else.com'}),opts(jwks))).rejects.toThrow(AccessDenied);
 await expect(verifyAccessJwt(await sign({}),opts(jwks))).rejects.toThrow(AccessDenied);
 await expect(verifyAccessJwt(await sign({email:EMAIL.toUpperCase()}),opts(jwks))).resolves.toEqual({email:EMAIL});
});

test('wrong audience, wrong issuer, expiry and junk are rejected',async()=>{
 const {jwks,sign}=await harness();
 await expect(verifyAccessJwt(await sign({email:EMAIL},{aud:'other'}),opts(jwks))).rejects.toThrow();
 await expect(verifyAccessJwt(await sign({email:EMAIL},{iss:'https://evil.cloudflareaccess.com'}),opts(jwks))).rejects.toThrow();
 await expect(verifyAccessJwt(await sign({email:EMAIL},{exp:'-1m'}),opts(jwks))).rejects.toThrow();
 await expect(verifyAccessJwt('not-a-jwt',opts(jwks))).rejects.toThrow();
});

test('requireAdmin refuses a request with no Access header',async()=>{
 await expect(requireAdmin(new Request('https://admin.test/'))).rejects.toThrow(AccessDenied);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx playwright test tests/admin-access.spec.ts --reporter=line`
Expected: FAIL — cannot resolve `../admin/src/lib/access`.

- [ ] **Step 4: Write `admin/src/lib/access.ts`**

```typescript
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type AccessIdentity = { email: string };

export class AccessDenied extends Error {}

export type VerifyOptions = {
  teamDomain: string;
  aud: string;
  allowedEmail: string;
  jwks?: JWTVerifyGetKey;
};

const remoteJwks = new Map<string, JWTVerifyGetKey>();

function jwksFor(teamDomain: string): JWTVerifyGetKey {
  const cached = remoteJwks.get(teamDomain);
  if (cached) return cached;
  // jose caches and refreshes the key set, which covers Access's 6-weekly rotation.
  const created = createRemoteJWKSet(
    new URL(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`),
  );
  remoteJwks.set(teamDomain, created);
  return created;
}

export async function verifyAccessJwt(
  token: string,
  options: VerifyOptions,
): Promise<AccessIdentity> {
  const { payload } = await jwtVerify(token, options.jwks ?? jwksFor(options.teamDomain), {
    issuer: `https://${options.teamDomain}.cloudflareaccess.com`,
    audience: options.aud,
  });
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || email !== options.allowedEmail.toLowerCase()) {
    throw new AccessDenied("Not an authorised admin identity.");
  }
  return { email };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new AccessDenied(`${name} is not configured.`);
  return value;
}

export async function requireAdmin(request: Request): Promise<AccessIdentity> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new AccessDenied("Missing Access assertion.");
  return verifyAccessJwt(token, {
    teamDomain: required("CF_ACCESS_TEAM_DOMAIN"),
    aud: required("CF_ACCESS_AUD"),
    allowedEmail: required("ADMIN_EMAIL"),
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/admin-access.spec.ts --reporter=line`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add admin/src/lib/access.ts admin/package.json admin/package-lock.json tests/admin-access.spec.ts
git commit -m "feat: verify Cloudflare Access identity in the admin console"
```

---

### Task 3: Audit log table and the server-only Supabase client

**Files:**
- Create: `supabase/migrations/20260910000000_admin_audit_log.sql`, `admin/src/lib/supabase.ts`, `admin/src/lib/audit.ts`
- Test: `tests/admin-audit.spec.ts`

**Interfaces:**
- Consumes: `AccessIdentity` from Task 2.
- Produces:
  - `adminClient(): SupabaseClient` — service-role client, server-only
  - `type AuditEntry = { actor: string; action: string; targetTable: string; targetId: string; detail?: Record<string, unknown> }`
  - `recordAudit(client: SupabaseClient, entry: AuditEntry): Promise<void>` — throws if the insert fails

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260910000000_admin_audit_log.sql`:

```sql
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor text not null check (char_length(actor) between 3 and 254),
  action text not null check (char_length(action) between 1 and 64),
  target_table text not null check (char_length(target_table) between 1 and 64),
  target_id text not null check (char_length(target_id) between 1 and 128),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc, id desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_table, target_id);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select, insert on public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;
```

- [ ] **Step 2: Write the failing test**

Create `tests/admin-audit.spec.ts`:

```typescript
import {test,expect} from '@playwright/test';
import {recordAudit} from '../admin/src/lib/audit';

function fakeClient(error:any=null){
 const rows:any[]=[];
 return {rows,client:{from(table:string){return{insert:async(value:any)=>{rows.push({table,value});return{error};}};}} as any};
}

test('an audit entry is written with actor, action and target',async()=>{
 const {rows,client}=fakeClient();
 await recordAudit(client,{actor:'admin@example.com',action:'wall.delete',targetTable:'social_posts',targetId:'post-1',detail:{author:'Aina'}});
 expect(rows).toHaveLength(1);
 expect(rows[0].table).toBe('admin_audit_log');
 expect(rows[0].value).toMatchObject({actor:'admin@example.com',action:'wall.delete',target_table:'social_posts',target_id:'post-1',detail:{author:'Aina'}});
});

test('a failed audit write throws so the caller cannot report success',async()=>{
 const {client}=fakeClient({message:'nope'});
 await expect(recordAudit(client,{actor:'a@b.com',action:'wall.delete',targetTable:'social_posts',targetId:'post-1'})).rejects.toThrow();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx playwright test tests/admin-audit.spec.ts --reporter=line`
Expected: FAIL — cannot resolve `../admin/src/lib/audit`.

- [ ] **Step 4: Write `admin/src/lib/supabase.ts`**

```typescript
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
```

- [ ] **Step 5: Write `admin/src/lib/audit.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEntry = {
  actor: string;
  action: string;
  targetTable: string;
  targetId: string;
  detail?: Record<string, unknown>;
};

export async function recordAudit(client: SupabaseClient, entry: AuditEntry): Promise<void> {
  const { error } = await client.from("admin_audit_log").insert({
    actor: entry.actor,
    action: entry.action,
    target_table: entry.targetTable,
    target_id: entry.targetId,
    detail: entry.detail ?? null,
  });
  if (error) throw new Error(`Could not write the audit entry: ${error.message}`);
}
```

- [ ] **Step 6: Install the Supabase client and `server-only`**

```bash
cd admin && npm install @supabase/supabase-js server-only
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx playwright test tests/admin-audit.spec.ts --reporter=line`
Expected: 2 passed.

- [ ] **Step 8: Apply the migration**

```bash
cd /Users/yusufsuhair/Downloads/astra
supabase migration list          # confirm only the new migration is pending
supabase db push --yes
supabase migration list          # the new timestamp now appears in the remote column
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260910000000_admin_audit_log.sql admin/src/lib/supabase.ts admin/src/lib/audit.ts admin/package.json admin/package-lock.json tests/admin-audit.spec.ts
git commit -m "feat: add the admin audit log and server-only Supabase client"
```

---

### Task 4: List Wall posts

**Files:**
- Create: `admin/src/lib/wall.ts`, `admin/src/app/wall/page.tsx`
- Test: `tests/admin-wall.spec.ts`

**Interfaces:**
- Consumes: `adminClient()` from Task 3.
- Produces:
  - `type AdminWallPost = { id: string; userId: string; author: string; text: string; mediaType: 'image' | 'audio' | null; mediaUrl: string | null; mediaPath: string | null; createdAt: string }`
  - `listWallPosts(client: SupabaseClient, limit?: number): Promise<AdminWallPost[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/admin-wall.spec.ts`:

```typescript
import {test,expect} from '@playwright/test';
import {listWallPosts} from '../admin/src/lib/wall';

function fakeClient(rows:any[]){
 return {
  from(){return{select(){return{order(){return{order(){return{limit:async()=>({data:rows,error:null})};}};}};}};},
  storage:{from(){return{getPublicUrl:(path:string)=>({data:{publicUrl:`https://cdn.test/${path}`}})};}},
 } as any;
}

test('posts are returned newest-first with a resolved media url',async()=>{
 const client=fakeClient([
  {id:'p2',user_id:'u2',author_name:'Aina',body:'later',media_path:'u2/x.png',media_type:'image',created_at:'2026-09-09T10:00:00Z'},
  {id:'p1',user_id:'u1',author_name:'Yusuf',body:'earlier',media_path:null,media_type:null,created_at:'2026-09-09T09:00:00Z'},
 ]);
 const posts=await listWallPosts(client);
 expect(posts.map(p=>p.id)).toEqual(['p2','p1']);
 expect(posts[0]).toMatchObject({author:'Aina',mediaType:'image',mediaPath:'u2/x.png',mediaUrl:'https://cdn.test/u2/x.png'});
 expect(posts[1].mediaUrl).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/admin-wall.spec.ts --reporter=line`
Expected: FAIL — cannot resolve `../admin/src/lib/wall`.

- [ ] **Step 3: Write `admin/src/lib/wall.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "social-wall";

export type AdminWallPost = {
  id: string;
  userId: string;
  author: string;
  text: string;
  mediaType: "image" | "audio" | null;
  mediaUrl: string | null;
  mediaPath: string | null;
  createdAt: string;
};

export async function listWallPosts(client: SupabaseClient, limit = 50): Promise<AdminWallPost[]> {
  const { data, error } = await client
    .from("social_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load Wall posts: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    author: row.author_name,
    text: row.body,
    mediaType: row.media_type ?? null,
    mediaPath: row.media_path ?? null,
    mediaUrl: row.media_path
      ? client.storage.from(BUCKET).getPublicUrl(row.media_path).data.publicUrl
      : null,
    createdAt: row.created_at,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/admin-wall.spec.ts --reporter=line`
Expected: 1 passed.

- [ ] **Step 5: Write `admin/src/app/wall/page.tsx`**

```tsx
import { adminClient } from "@/lib/supabase";
import { listWallPosts } from "@/lib/wall";

export const dynamic = "force-dynamic";

export default async function WallPage() {
  const posts = await listWallPosts(adminClient());
  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 820 }}>
      <h1>Wall moderation</h1>
      {posts.length === 0 && <p>No posts.</p>}
      {posts.map((post) => (
        <article key={post.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <strong>{post.author}</strong>
          <time style={{ marginLeft: 8, color: "#666" }}>{new Date(post.createdAt).toLocaleString("en-MY")}</time>
          {post.text && <p style={{ whiteSpace: "pre-wrap" }}>{post.text}</p>}
          {post.mediaType === "image" && post.mediaUrl && (
            <img src={post.mediaUrl} alt="" style={{ maxWidth: "100%", borderRadius: 6 }} />
          )}
        </article>
      ))}
    </main>
  );
}
```

- [ ] **Step 6: Verify the page renders locally**

Create `admin/.dev.vars` (already gitignored by Task 1) with the two values. The project URL
is `https://your-project.supabase.co`; the service-role key comes from the Supabase
dashboard under Project Settings → API → `service_role`. Do not paste the key into any
committed file, and do not echo it into the terminal.

```
NEXTJS_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<paste from the Supabase dashboard>
```

Then:

```bash
cd admin && npm run preview
```

Open the preview URL at `/wall`. Expected: the real Wall posts render. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
cd /Users/yusufsuhair/Downloads/astra
git add admin/src/lib/wall.ts admin/src/app/wall/page.tsx tests/admin-wall.spec.ts
git commit -m "feat: list Wall posts in the admin console"
```

---

### Task 5: Delete any Wall post

This is the task that closes the gap the spec identifies: today nobody can remove another player's photo.

**Files:**
- Modify: `admin/src/lib/wall.ts`, `admin/src/app/wall/page.tsx`
- Create: `admin/src/app/wall/actions.ts`
- Test: `tests/admin-wall.spec.ts` (add cases)

**Interfaces:**
- Consumes: `recordAudit` from Task 3, `AdminWallPost` from Task 4.
- Produces: `deleteWallPost(client: SupabaseClient, postId: string, actor: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Append to `tests/admin-wall.spec.ts`:

```typescript
import {deleteWallPost} from '../admin/src/lib/wall';

function deleteHarness(post:any){
 const removed:string[]=[], audits:any[]=[]; let deleted=false;
 const client:any={
  from(table:string){
   if(table==='admin_audit_log')return{insert:async(value:any)=>{audits.push(value);return{error:null};}};
   return{
    select(){return{eq(){return{single:async()=>post?{data:post,error:null}:{data:null,error:{message:'missing'}}};}};},
    delete(){return{eq:async()=>{deleted=true;return{error:null};}};},
   };
  },
  storage:{from(){return{remove:async(paths:string[])=>{removed.push(...paths);return{error:null};}};}},
 };
 return {client,removed,audits,wasDeleted:()=>deleted};
}

test('deleting a post removes its row, its stored file and writes an audit entry',async()=>{
 const h=deleteHarness({id:'p1',user_id:'u1',author_name:'Aina',media_path:'u1/x.png'});
 await deleteWallPost(h.client,'p1','admin@example.com');
 expect(h.wasDeleted()).toBe(true);
 expect(h.removed).toEqual(['u1/x.png']);
 expect(h.audits[0]).toMatchObject({action:'wall.delete',target_table:'social_posts',target_id:'p1',actor:'admin@example.com'});
});

test('a text-only post deletes without touching storage',async()=>{
 const h=deleteHarness({id:'p2',user_id:'u1',author_name:'Aina',media_path:null});
 await deleteWallPost(h.client,'p2','admin@example.com');
 expect(h.wasDeleted()).toBe(true);
 expect(h.removed).toEqual([]);
});

test('deleting a post that does not exist throws and writes no audit entry',async()=>{
 const h=deleteHarness(null);
 await expect(deleteWallPost(h.client,'nope','admin@example.com')).rejects.toThrow();
 expect(h.audits).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/admin-wall.spec.ts --reporter=line`
Expected: the three new tests FAIL — `deleteWallPost` is not exported.

- [ ] **Step 3: Add `deleteWallPost` to `admin/src/lib/wall.ts`**

Add this import at the top of the file:

```typescript
import { recordAudit } from "./audit";
```

and append:

```typescript
export async function deleteWallPost(
  client: SupabaseClient,
  postId: string,
  actor: string,
): Promise<void> {
  const found = await client.from("social_posts").select("*").eq("id", postId).single();
  if (found.error || !found.data) throw new Error("That post no longer exists.");

  const removal = await client.from("social_posts").delete().eq("id", postId);
  if (removal.error) throw new Error(`Could not delete the post: ${removal.error.message}`);

  // Storage is cleaned after the row so a failed delete never orphans a live post's image.
  if (found.data.media_path) await client.storage.from(BUCKET).remove([found.data.media_path]);

  await recordAudit(client, {
    actor,
    action: "wall.delete",
    targetTable: "social_posts",
    targetId: postId,
    detail: { author: found.data.author_name, mediaPath: found.data.media_path ?? null },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/admin-wall.spec.ts --reporter=line`
Expected: 4 passed.

- [ ] **Step 5: Write the server action `admin/src/app/wall/actions.ts`**

```typescript
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
```

- [ ] **Step 6: Add the delete control to `admin/src/app/wall/page.tsx`**

Add this import at the top:

```tsx
import { removePost } from "./actions";
```

and place this inside the `<article>`, after the image:

```tsx
<form action={removePost}>
  <input type="hidden" name="postId" value={post.id} />
  <button type="submit" style={{ marginTop: 8, color: "#a13f31" }}>Delete post</button>
</form>
```

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: the admin specs pass. Pre-existing failures in `game.spec.ts`, `table-flow.spec.ts` and `table-social.spec.ts` are unrelated to this work and are not introduced by it.

- [ ] **Step 8: Commit**

```bash
git add admin/src/lib/wall.ts admin/src/app/wall/page.tsx admin/src/app/wall/actions.ts tests/admin-wall.spec.ts
git commit -m "feat: delete any Wall post from the admin console"
```

---

### Task 6: Deploy behind Cloudflare Access

**Files:**
- Modify: `admin/wrangler.jsonc`

**Interfaces:**
- Consumes: everything above.
- Produces: a live, protected console at `https://admin.lepakmamak.my`.

- [ ] **Step 1: Create the Access application (manual, in the Cloudflare dashboard)**

Zero Trust → Access → Applications → Add a self-hosted application.
- Application domain: `admin.lepakmamak.my`
- Policy: Allow, include → Emails → `admin@example.com`
- Identity provider: Google
- After saving, open Configure → Additional settings and copy the **Application Audience (AUD) tag**.
- Note the team domain, i.e. the `<team>` in `<team>.cloudflareaccess.com`.

- [ ] **Step 2: Set the Worker secrets**

```bash
cd admin
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN     # the <team> value, no protocol
npx wrangler secret put CF_ACCESS_AUD             # the AUD tag from step 1
npx wrangler secret put ADMIN_EMAIL               # admin@example.com
```

- [ ] **Step 3: Deploy**

```bash
cd admin && npm run deploy
```

Expected: wrangler prints the deployed `*.workers.dev` URL.

- [ ] **Step 4: Attach the custom domain**

In the Cloudflare dashboard: Workers & Pages → `lepakmamak-admin` → Settings → Domains & Routes → Add custom domain → `admin.lepakmamak.my`.

- [ ] **Step 5: Verify the protection actually works**

```bash
# Browser: visit https://admin.lepakmamak.my — expect a Google sign-in, then the console.
# Terminal with no Access session:
curl -s -o /dev/null -w '%{http_code}\n' https://admin.lepakmamak.my/wall
curl -s https://admin.lepakmamak.my/wall | grep -ci "wall moderation"   # expect 0
```

Expected: the curl never returns console content. If it returns the page, the Access policy is not attached — stop and fix before continuing.

- [ ] **Step 6: Verify a real deletion end to end**

Sign in, open `/wall`, delete a disposable test post, and confirm the audit row exists in the Supabase dashboard SQL editor:

```sql
select actor, action, target_id, created_at from admin_audit_log order by id desc limit 1;
```

Expected: one row naming the admin email and `wall.delete`.

- [ ] **Step 7: Commit**

```bash
git add admin/wrangler.jsonc
git commit -m "chore: deploy the admin console to admin.lepakmamak.my"
```

---

## Not in this plan

Coins, chat moderation, and shop/orders are Plan 2, along with the
`game_currency_transactions` changes (`reason` gaining `'admin'`, the `note` column) and
the `admin_adjust_balance` function. Plan 1 stands alone: a protected, audited console that
can remove any Wall post.

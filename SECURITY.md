# Security Notes

Last audit: 2026-02-09

## Dependency Overrides

All 12 transitive vulnerabilities from `pnpm audit` have been resolved via `pnpm.overrides` in `package.json`. Every overridden dependency is **build-time/tooling only** — none are loaded in the production runtime bundle.

| Package | Via | Context | Override |
|---------|-----|---------|----------|
| trim-newlines | mdx > meow | Build-time MDX processing | >=3.0.1 |
| glob | react-email | Dev email preview CLI | >=11.1.0 |
| @isaacs/brace-expansion | react-email > glob > minimatch | Dev email preview CLI | >=5.0.1 |
| qs | prisma-zod-generator > express | Build-time code generation | >=6.14.1 |
| body-parser | prisma-zod-generator > express | Build-time code generation | >=2.2.1 |
| fast-xml-parser | @types/nodemailer > @aws-sdk | Type definitions only | >=5.3.4 |
| lodash | start-server-and-test > wait-on | E2E test tooling (devDep) | >=4.17.23 |
| js-yaml | content-collections > gray-matter, prisma-zod-generator | Build-time content/codegen | >=4.1.1 |
| mdast-util-to-hast | @mdx-js/mdx > remark-rehype | Build-time MDX processing | >=13.2.1 |
| @smithy/config-resolver | @aws-sdk/client-s3 | S3 storage client (server-side) | >=4.4.0 |
| esbuild | Multiple (build tooling) | Build-time bundler | >=0.25.0 |

### Why overrides are safe here

These overrides force minimum versions for packages that are only used during:
- `pnpm build` (MDX processing, Prisma codegen, content collections)
- `pnpm dev` (react-email preview, HMR tooling)
- `pnpm e2e` (start-server-and-test)

None of these vulnerable packages are imported in route handlers or client bundles. The `@smithy/config-resolver` override is the only one touching a runtime package (@aws-sdk/client-s3 for storage), but the vulnerability is a defense-in-depth region validation issue (low severity).

## Content Security Policy

### Current implementation (proxy.ts)

The CSP uses **nonce-based script control** with `'strict-dynamic'`:

**Production:**
```
script-src 'self' 'nonce-<per-request>' 'strict-dynamic'
style-src 'self' 'nonce-<per-request>'
```

**Development only:**
```
script-src 'self' 'nonce-<per-request>' 'strict-dynamic' 'unsafe-eval'
style-src 'self' 'unsafe-inline'
```

- `'unsafe-eval'` is required in development for React Fast Refresh / HMR
- `'unsafe-inline'` for styles is required in development for Turbopack style injection
- Neither is present in production builds
- The nonce is passed to server components via the `x-nonce` request header

### Reading the nonce in components

Server components that need to inject third-party scripts should read the nonce:

```tsx
import { headers } from 'next/headers';

export default async function Page() {
  const nonce = (await headers()).get('x-nonce');
  return <script nonce={nonce} src="..." />;
}
```

## Audit Log Table

The `logAudit()` helper (`apps/web/lib/audit-log.ts`) writes to a Supabase table called `audit_log`. This table is **not managed by Prisma** — it must be created manually in Supabase.

### Startup verification

`apps/web/instrumentation.ts` runs a probe query on server startup. If the table doesn't exist, it logs the full CREATE TABLE SQL to the console.

### Required SQL (run in Supabase SQL Editor)

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  user_id TEXT,
  tenant_id TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

### RGPD considerations

- Audit logs contain IP addresses and user agent strings (PII under RGPD)
- Set up a retention policy to auto-delete entries older than 12 months
- The `tenant_id` index supports per-tenant data purge on account deletion

# Storage budget (stay on free tiers)

## Supabase free plan (verify current limits before launch)
- Database 500 MB. Exceeding it makes the project read-only. This is data size, not disk size.
- File storage 1 GB. Egress 5 GB plus 5 GB cached. Projects pause after 1 week of inactivity.
- Two active projects per organisation.

## Working budget
- Database: keep under 350 MB (70%).
- Estimate (measure it): about 0.4 to 0.5 KB per stored item (ciphertext + IV/tag + ids +
  row and index overhead). A very busy 4-week room is about 1,000 items, about 0.5 MB.
- Media goes to Cloudflare R2 (free tier: 10 GB storage, 1 M writes, 10 M reads per month, no
  egress fees), never Postgres. Encrypted objects only.

## Rules
- Per room caps: items, max bytes per item (put anything large in R2), about 20 photos, voice 30 s.
- Photos about 1280 px, target 200 KB or less. Voice 32 kbps Opus or AAC, about 120 KB per 30 s.
- Binary as `bytea`. Compress text before encrypting. One index per table unless measured.
- Nightly batched deletion of expired rooms; autovacuum; watch for bloat.
- Delete old anonymous users on a schedule.
- Daily check: alert at 60% and 80%; pause new rooms at 70%; friendly message.
- Keep-alive ping so the free project never pauses.
- Read-only mode must still allow reading and downloading.

## Monitoring SQL
```sql
select pg_size_pretty(pg_database_size(current_database()));
select relname, pg_size_pretty(pg_total_relation_size(relid))
from pg_catalog.pg_statio_user_tables order by pg_total_relation_size(relid) desc limit 10;
select count(*) from auth.users;
```

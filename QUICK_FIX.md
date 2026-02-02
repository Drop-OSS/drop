# Quick Reference: 7z OOM Fix

## Problem
Container crashes with OOM when importing large games. ~120 7z processes exceed memory limits.

## Solution
Add memory limits to `docker-compose.yml`:

```yaml
drop:
  mem_limit: 4g
  memswap_limit: 5g
```

## Configuration by System Size

| System | mem_limit | memswap_limit | Best for |
|--------|-----------|---------------|----------|
| 4GB RAM | 1g | 2g | Test/tiny |
| 8GB RAM | 2g | 3g | Small |
| 16GB RAM | 4g | 5g | **Recommended** |
| 32GB+ RAM | 8g | 10g | Large |

## Quick Deploy

```bash
# 1. Update your compose file
# Edit: compose.yml and add to 'drop' service:
mem_limit: 4g
memswap_limit: 5g

# 2. Restart
docker-compose down
docker-compose up -d

# 3. Test
docker stats  # Monitor memory
# Then import a large game through the UI
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Still getting OOM | Increase mem_limit to 8g, 10g, etc. |
| Very slow imports | That's normal with limits. Adjust up if needed |
| Memory stuck high | Check `docker logs drop` for errors |
| Container restart loop | Reduce mem_limit, check disk space |

## Files to Update

1. ✅ `deploy-template/compose.yml` - Add memory limits
2. ✅ `server/internal/utils/concurrency.ts` - Optional utility
3. ✅ Documentation files - For reference

## Verification

```bash
# Check if limits are applied
docker inspect drop | grep -A 2 Memory

# Monitor during import
watch docker stats drop

# Check for OOM errors
docker logs drop | grep -i "oom\|memory"
# Should return nothing if working
```

## Key Points

- 🟢 **Mandatory:** Update compose file with memory limits
- 🟡 **Optional:** Use concurrency utility for custom code
- 🔵 **Recommended:** Monitor first few large imports
- 🔴 **Never:** Remove memory limits or leave unlimited

---

**See:** IMPLEMENTATION_SUMMARY.md and 7Z_MEMORY_FIX.md for details

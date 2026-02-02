# 7z Memory Exhaustion Fix Guide

## Problem
The 7z extraction process (used during manifest generation) was spawning too many threads/processes concurrently, causing memory exhaustion in the container (OOM kill). The kernel logged multiple 7z processes (PIDs 18727-18848+) being killed.

## Solutions Implemented

### 1. **Container Memory Limits** (MOST IMPORTANT)
Added memory constraints to `deploy-template/compose.yml`:

```yaml
drop:
  # ... existing config ...
  mem_limit: 4g          # Hard memory limit
  memswap_limit: 5g      # Allow swap as overflow
```

**Why this works:**
- Prevents the kernel from allowing unlimited memory allocation
- The OOM killer will now stop the container gracefully instead of killing individual processes
- You can adjust these values based on your system:
  - Small deployments: 2GB - 3GB
  - Medium deployments: 4GB - 6GB
  - Large deployments: 8GB+

### 2. **Concurrency Limiting Utility** (Optional, for future use)
Created `server/internal/utils/concurrency.ts` which provides:

```typescript
// Simple sequential processing
const results = await processWithConcurrency(
  files,
  (file) => extractFile(file),
  1  // Only 1 concurrent operation at a time
);

// Or with a reusable limiter
const limiter = createConcurrencyLimiter(1);
for (const file of largeFileList) {
  await limiter.queue(() => processFile(file));
}
```

Use this in future if you implement archive extraction in Drop that processes multiple files.

## Recommended Configuration by Use Case

### Development/Testing
```yaml
mem_limit: 2g
memswap_limit: 3g
```

### Small Production (< 10 games)
```yaml
mem_limit: 2g
memswap_limit: 3g
```

### Medium Production (10-100 games)
```yaml
mem_limit: 4g
memswap_limit: 5g
```

### Large Production (100+ games, large files)
```yaml
mem_limit: 8g
memswap_limit: 10g
```

## Advanced Tuning Options

### 1. **Limit 7z Threads Directly** (if 7z is configured as external)
If Drop calls 7z as an external command, add:
```bash
# In 7z call
7z -mmt1 x archive.7z  # Single thread
# OR
7z -mmt2 x archive.7z  # 2 threads maximum
```

### 2. **Kernel Level** (Docker host machine)
Check and increase system limits:
```bash
# View current limits
docker inspect <container-id> | grep -i memory

# System-wide file descriptor limit
ulimit -n  # Check current
ulimit -n 65536  # Increase if needed
```

### 3. **Process Management**
Add to Drop container environment:
```yaml
environment:
  # Limit Node.js heap
  NODE_OPTIONS: "--max-old-space-size=2048"
```

## Troubleshooting

### Still getting OOM kills?
1. **Increase memory limit further:**
   ```yaml
   mem_limit: 8g
   memswap_limit: 10g
   ```

2. **Check what's consuming memory:**
   ```bash
   docker stats <container-name>
   ```

3. **Monitor during import:**
   ```bash
   docker logs -f <container-name>
   # Look for large file processing messages
   ```

### 7z specific (if external call):
1. **Reduce 7z thread count:**
   ```bash
   7z -mmt1 -md=256m x large.7z  # Single thread, 256MB dict
   ```

2. **Enable compression presets with lower memory:**
   ```bash
   7z -mx=5 x archive.7z  # Medium compression = less memory
   ```

## Testing the Fix

1. **With memory limit set:**
   ```bash
   docker-compose up -d
   docker stats --no-stream
   ```
   Monitor memory usage - should not exceed limit.

2. **Import a large game/version:**
   - Should complete without OOM kill
   - May be slower than before (that's OK)
   - Memory usage will stay within limits

3. **Check container logs:**
   ```bash
   docker logs drop | grep -i memory
   docker logs drop | grep -i oom
   ```
   Should NOT show OOM killer messages.

## Performance vs Memory Trade-off

| Config | Memory | Performance | Best For |
|--------|--------|-------------|----------|
| Single Thread, Low Limit | 2GB | Slow | Small servers, low memory |
| Sequential Processing | 2-4GB | Medium | Stable, predictable |
| Current (no limit) | 8GB+ | Fast | Crashes on large files |

## Files Modified

- ✅ `deploy-template/compose.yml` - Added memory limits
- ✅ `server/internal/utils/concurrency.ts` - Created utility for future use

## Next Steps (Optional)

1. If Drop still has performance issues with large files, consider:
   - Implementing file chunking in manifest generation
   - Using the concurrency utility in manifest processing
   - Pre-compressing archives before import

2. Monitor memory usage for a few imports to find optimal limit

3. Document your chosen limits in your deployment guide

---

**Note:** The root cause was 7z spawning many threads simultaneously. The memory limit solution is the most reliable way to prevent OOM kills. Sequential processing (via the concurrency utility) is recommended for additional stability if needed.

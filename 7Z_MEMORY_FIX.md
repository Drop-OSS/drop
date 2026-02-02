# 7z Memory Exhaustion Fix Guide

## Problem
The 7z extraction process (used during manifest generation) was spawning too many threads/processes concurrently, causing memory exhaustion in the container (OOM kill). The kernel logged multiple 7z processes being killed with memory usage reaching 100MB-400MB+ per process.

**Symptoms:**
- `Out of memory: Killed process (7z)` messages in kernel logs
- Container crashes during large game imports
- Frequent restarts when processing compressed archives

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
NODE_OPTIONS: "--max-old-space-size=1024"
```

### Small Production (< 10 games)
```yaml
mem_limit: 4g
memswap_limit: 5g
NODE_OPTIONS: "--max-old-space-size=2560"
```

### Medium Production (10-100 games)
```yaml
mem_limit: 8g
memswap_limit: 10g
NODE_OPTIONS: "--max-old-space-size=5120"
```

### Large Production (100+ games, large files, high concurrency)
```yaml
mem_limit: 12g
memswap_limit: 16g
NODE_OPTIONS: "--max-old-space-size=8192"
```

### Extra Large (500+ games, very large archives >2GB)
```yaml
mem_limit: 16g
memswap_limit: 20g
NODE_OPTIONS: "--max-old-space-size=11264"
```

**Guideline:** Set `NODE_OPTIONS` to roughly 65-70% of your `mem_limit`. This leaves room for system processes and 7z operations.

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

### Still getting OOM kills? (Repeated kernel messages)

**Step 1: Immediately increase limits**
```yaml
# Start with this if you're experiencing crashes:
mem_limit: 12g        # Much higher than before
memswap_limit: 16g    # Allows temporary overflow
NODE_OPTIONS: "--max-old-space-size=8192"
```

**Step 2: Verify your system has capacity**
```bash
# Check total system RAM
free -h
# OR on macOS/Docker Desktop
docker stats --no-stream

# You need: mem_limit + 2-3GB for host OS
# Example: 16GB system → max 12-13GB for container
```

**Step 3: Monitor actual usage**
```bash
# Before import
docker stats --no-stream drop

# During import (in another terminal)
watch -n 1 'docker stats --no-stream drop | tail -1'

# After import
docker logs drop | tail -20
```

**Step 4: Adjust based on observed usage**
| Observed Usage | Recommendation |
|---|---|
| 95%+ of limit | Increase by 50% more |
| 80-95% | Use slightly higher limit |
| 60-80% | Current setting is good |
| <60% | Can reduce by 2GB if desired |

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

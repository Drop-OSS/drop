# Deployment Memory Tuning Guide

## Quick Start for OOM Issues

If you're seeing `Out of memory: Killed process` errors with 7z or the container crashing during large game imports, follow this guide.

## Step 1: Determine Your System Capacity

```bash
# Linux/Mac terminal:
free -h

# Docker Desktop (Windows/Mac):
docker stats --no-stream

# Note: Calculate available for container as: Total RAM - 2-3GB (for host OS)
```

**Example:**
- 16GB system → Available: ~13GB → Use mem_limit: 12g
- 32GB system → Available: ~29GB → Use mem_limit: 24g
- 8GB system → Available: ~5GB → Use mem_limit: 4g

## Step 2: Update Your compose.yml

Use these settings in your `docker-compose.yml` or `compose.yml`:

```yaml
services:
  drop:
    image: ghcr.io/drop-oss/drop:nightly
    # ... other config ...
    
    environment:
      - DATABASE_URL=postgres://drop:drop@postgres:5432/drop
      # Set Node.js heap limit (65-70% of mem_limit)
      - NODE_OPTIONS=--max-old-space-size=8192
    
    # Set to 60-70% of available system RAM
    mem_limit: 12g
    memswap_limit: 16g
    
    cpus: "6.0"  # Adjust based on your CPU cores
    
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
      nproc:
        soft: 4096
        hard: 4096
```

## Step 3: Restart and Monitor

```bash
# Stop the container
docker-compose down

# Start with new settings
docker-compose up -d

# Monitor for memory issues (wait 30 seconds for startup)
sleep 30
docker stats --no-stream drop

# Watch real-time during import
watch -n 1 'docker stats --no-stream drop | tail -1'
```

## Step 4: Test with Large Game Import

1. Go to your Drop UI
2. Import a large game/version (1GB+ archive if possible)
3. Watch the memory usage in another terminal
4. Check for OOM errors in logs:
   ```bash
   docker logs drop 2>&1 | grep -i "oom\|killed\|memory"
   ```

## Memory Size Reference Table

| System RAM | mem_limit | memswap_limit | NODE_OPTIONS | Use Case |
|---|---|---|---|---|
| 4GB | 1g | 2g | 512m | Development only |
| 8GB | 4g | 5g | 2560m | Small production |
| 16GB | 12g | 16g | 8192m | **Recommended** |
| 32GB | 24g | 30g | 16384m | Large production |
| 64GB+ | 48g | 60g | 32768m | Enterprise |

## Common Issues & Solutions

### Still crashing after increasing limits?

1. **Verify limits are applied:**
   ```bash
   docker inspect drop | grep -A 2 '"Memory"'
   ```

2. **Check actual container memory during operation:**
   ```bash
   # Terminal 1: Start import
   # Terminal 2: Monitor
   watch -n 1 'docker stats --no-stream drop'
   ```

3. **If usage is at or above limit:**
   - Increase mem_limit by another 50%
   - Verify your system actually has available RAM
   - Check if host system is swapping (bad sign)

4. **If usage stays low but still crashes:**
   - Issue might be elsewhere (disk space, database)
   - Check: `docker logs drop` for error details
   - Verify database connection: `docker logs postgres`

### Memory usage is very high (90%+)?

**Option A: Increase limits** (Recommended if you have RAM)
```yaml
mem_limit: 16g  # or higher
```

**Option B: Reduce concurrency** (If you want lower memory)
- Currently Drop processes multiple game imports in parallel
- Consider importing one game at a time
- Monitor library scanning (can be memory intensive)

**Option C: Spread operations over time**
- Schedule large imports during low-traffic periods
- Let memory-intensive operations complete before starting new ones

## Monitoring Best Practices

### Before Deployment
```bash
# Capture baseline
docker stats --no-stream drop > baseline_memory.txt
```

### After Major Operations
```bash
# Check memory isn't stuck high
docker stats --no-stream drop
docker top drop -aux | head -5
```

### Weekly Health Check
```bash
# Monitor for memory leaks (should be stable)
for i in {1..10}; do
  echo "Check $i: $(date)"
  docker stats --no-stream drop
  sleep 60
done
```

## Advanced Tuning

### For Very Large Files (>5GB archives)
```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=10240
mem_limit: 16g
memswap_limit: 20g
```

### For Low-Memory Systems
```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=1024
mem_limit: 2g
memswap_limit: 3g
```

### With Custom 7z Configuration (if available)
```bash
# In your extraction code:
7z -mmt2 -md=256m x archive.7z
# -mmt2: Use max 2 threads
# -md=256m: Use 256MB dictionary
```

## Performance Expectations

| Setting | Speed | Memory | Stability |
|---|---|---|---|
| Low limits (2-4GB) | Slow | <50% | Stable |
| Medium limits (8-12GB) | Normal | 60-80% | **Best** |
| High limits (16GB+) | Fast | 40-60% | Stable |
| Very high limits (32GB+) | Very Fast | 20-40% | Overkill |

## Getting Help

If you still have OOM issues:

1. **Gather diagnostics:**
   ```bash
   docker stats --no-stream drop > memory.txt
   docker logs drop 2>&1 | tail -100 > logs.txt
   # Share these with your support team
   ```

2. **Check the logs:**
   ```bash
   docker logs drop | grep -i "oom\|memory\|killed"
   ```

3. **Verify settings:**
   ```bash
   docker inspect drop | grep -i "memory\|swap"
   ```

---

**Key Principle:** Memory limits prevent cascading failures. It's better to have one slow import than system crashes. Allocate generously based on available system RAM.

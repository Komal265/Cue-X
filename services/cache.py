import time
import logging

logger = logging.getLogger(__name__)

# In-memory store. Easy to replace with Redis later.
CACHE = {}

def set_cache(key: str, value: any, ttl: int = 300):
    """Store an item in the cache with a Time-To-Live (in seconds)."""
    CACHE[key] = {
        "value": value,
        "expiry": time.time() + ttl
    }
    logger.debug(f"[CACHE SET] {key} (TTL: {ttl}s)")

def get_cache(key: str) -> any:
    """Retrieve an item from the cache if it hasn't expired."""
    data = CACHE.get(key)
    if not data:
        logger.debug(f"[CACHE MISS] {key}")
        return None
    
    if time.time() > data["expiry"]:
        logger.debug(f"[CACHE EXPIRED] {key}")
        del CACHE[key]
        return None
        
    logger.debug(f"[CACHE HIT] {key}")
    return data["value"]

def clear_cache(prefix: str = None):
    """Clear all keys starting with `prefix`. If prefix is None, clear all."""
    if prefix:
        keys_to_delete = [k for k in CACHE if k.startswith(prefix)]
        for k in keys_to_delete:
            del CACHE[k]
        logger.debug(f"[CACHE CLEARED] Prefix: {prefix} ({len(keys_to_delete)} keys removed)")
    else:
        logger.debug(f"[CACHE CLEARED] All keys removed")
        CACHE.clear()

def get_cache_status() -> dict:
    """Return diagnostic info about the cache."""
    active_keys = 0
    expired_keys = 0
    now = time.time()
    
    for k, v in list(CACHE.items()):
        if now > v["expiry"]:
            expired_keys += 1
            del CACHE[k]
        else:
            active_keys += 1
            
    return {
        "active_keys": active_keys,
        "expired_keys_cleaned": expired_keys,
        "total_memory_slots": len(CACHE)
    }

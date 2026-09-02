import express from 'express';

/**
 * Enterprise In-Memory Sliding-Window Rate Limiter
 * Provides DDoS protection, resource exhaustion prevention, and standard RFC 6585 rate limiting headers.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: express.Request) => string;
}

interface ClientWindow {
  timestamps: number[];
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests from this IP or client, please try again later.',
    keyGenerator = (req) => {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.socket.remoteAddress || 'unknown-client';
    }
  } = config;

  const store = new Map<string, ClientWindow>();

  // Periodically clean up stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, client] of store.entries()) {
      client.timestamps = client.timestamps.filter(t => now - t < windowMs);
      if (client.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Exclude CORS preflight OPTIONS
    if (req.method === 'OPTIONS') return next();

    const clientKey = keyGenerator(req);
    const now = Date.now();

    let client = store.get(clientKey);
    if (!client) {
      client = { timestamps: [] };
      store.set(clientKey, client);
    }

    // Filter out timestamps outside the sliding window
    client.timestamps = client.timestamps.filter(t => now - t < windowMs);

    const remaining = Math.max(0, maxRequests - client.timestamps.length);
    const resetTimeSeconds = Math.ceil(windowMs / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (client.timestamps.length >= maxRequests) {
      res.setHeader('Retry-After', resetTimeSeconds);
      return res.status(429).json({
        error: message,
        statusCode: 429,
        retryAfterSeconds: resetTimeSeconds
      });
    }

    client.timestamps.push(now);
    next();
  };
}

/**
 * Request Body Schema & Sanitization Middleware
 */
export function validateBodyFields(requiredFields: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid or missing JSON request body' });
    }

    const missing: string[] = [];
    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required request fields: ${missing.join(', ')}`,
        missingFields: missing
      });
    }

    next();
  };
}

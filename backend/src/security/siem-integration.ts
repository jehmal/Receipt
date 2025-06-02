/**
 * SIEM Integration Service for Receipt Vault Pro
 * Comprehensive security monitoring and threat detection
 */

import { FastifyRequest } from 'fastify';
import { logger } from '../utils/logger';
import axios from 'axios';

// Security Event Types
export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHENTICATION_SUCCESS = 'auth_success',
  AUTHORIZATION_FAILURE = 'authz_failure',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  INJECTION_ATTEMPT = 'injection_attempt',
  ACCOUNT_LOCKOUT = 'account_lockout',
  PASSWORD_RESET = 'password_reset',
  SESSION_ANOMALY = 'session_anomaly',
  FILE_UPLOAD = 'file_upload',
  API_ABUSE = 'api_abuse',
  CONFIGURATION_CHANGE = 'config_change'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  source: string;
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent: string;
  resource?: string;
  action?: string;
  outcome: 'success' | 'failure' | 'warning';
  details: Record<string, any>;
  risk_score: number;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  device_info?: {
    type?: string;
    os?: string;
    browser?: string;
  };
}

class SIEMIntegrationService {
  private siemEndpoints: {
    splunk?: string;
    elastic?: string;
    sentinel?: string;
    sumo?: string;
    datadog?: string;
  };

  private rateLimitMap = new Map<string, number[]>();
  private suspiciousIPs = new Set<string>();
  private bruteForceAttempts = new Map<string, number>();

  constructor() {
    this.siemEndpoints = {
      splunk: process.env.SPLUNK_HEC_ENDPOINT,
      elastic: process.env.ELASTICSEARCH_ENDPOINT,
      sentinel: process.env.AZURE_SENTINEL_ENDPOINT,
      sumo: process.env.SUMO_LOGIC_ENDPOINT,
      datadog: process.env.DATADOG_LOGS_ENDPOINT
    };
  }

  /**
   * Log security event to all configured SIEM systems
   */
  async logSecurityEvent(event: Partial<SecurityEvent>, request?: FastifyRequest): Promise<void> {
    try {
      const enrichedEvent = await this.enrichSecurityEvent(event, request);
      
      // Real-time threat detection
      await this.performThreatDetection(enrichedEvent);
      
      // Send to SIEM systems
      await Promise.allSettled([
        this.sendToSplunk(enrichedEvent),
        this.sendToElastic(enrichedEvent),
        this.sendToSentinel(enrichedEvent),
        this.sendToSumoLogic(enrichedEvent),
        this.sendToDatadog(enrichedEvent)
      ]);

      // Log locally for backup
      logger.security('Security event logged', enrichedEvent);

    } catch (error) {
      logger.error('Failed to log security event', { error: error.message, event });
    }
  }

  /**
   * Enrich security event with additional context
   */
  private async enrichSecurityEvent(
    event: Partial<SecurityEvent>, 
    request?: FastifyRequest
  ): Promise<SecurityEvent> {
    const enrichedEvent: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      eventType: event.eventType || SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: event.severity || SecuritySeverity.MEDIUM,
      source: 'receipt-vault-backend',
      ip: request?.ip || event.details?.ip || 'unknown',
      userAgent: request?.headers['user-agent'] || 'unknown',
      outcome: event.outcome || 'warning',
      details: event.details || {},
      risk_score: event.risk_score || this.calculateRiskScore(event),
      ...event
    };

    // Add user context if available
    if (request?.user) {
      enrichedEvent.userId = (request.user as any).id;
      enrichedEvent.sessionId = request.session?.id;
    }

    // Add geolocation data
    enrichedEvent.geolocation = await this.getGeolocation(enrichedEvent.ip);

    // Add device information
    enrichedEvent.device_info = this.parseUserAgent(enrichedEvent.userAgent);

    // Add request context
    if (request) {
      enrichedEvent.details = {
        ...enrichedEvent.details,
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        query: request.query,
        referer: request.headers.referer
      };
    }

    return enrichedEvent;
  }

  /**
   * Real-time threat detection and automated response
   */
  private async performThreatDetection(event: SecurityEvent): Promise<void> {
    // Brute force detection
    if (event.eventType === SecurityEventType.AUTHENTICATION_FAILURE) {
      await this.detectBruteForce(event);
    }

    // Rate limit violation detection
    await this.detectRateLimitViolation(event);

    // Injection attempt detection
    if (event.details.query || event.details.body) {
      await this.detectInjectionAttempts(event);
    }

    // Anomalous behavior detection
    await this.detectAnomalousBehavior(event);

    // Geographic anomaly detection
    await this.detectGeographicAnomalies(event);

    // Session anomaly detection
    if (event.sessionId) {
      await this.detectSessionAnomalies(event);
    }
  }

  /**
   * Detect brute force attacks
   */
  private async detectBruteForce(event: SecurityEvent): Promise<void> {
    const key = `${event.ip}:${event.userId || 'anonymous'}`;
    const attempts = this.bruteForceAttempts.get(key) || 0;
    const newAttempts = attempts + 1;
    
    this.bruteForceAttempts.set(key, newAttempts);

    // Threshold: 5 failed attempts in 5 minutes
    if (newAttempts >= 5) {
      await this.logSecurityEvent({
        eventType: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        severity: SecuritySeverity.HIGH,
        outcome: 'failure',
        details: {
          ...event.details,
          attempts: newAttempts,
          timeWindow: '5 minutes'
        },
        risk_score: 8.0
      });

      // Automated response: Add IP to suspicious list
      this.suspiciousIPs.add(event.ip);
      
      // Clean up old attempts (after 5 minutes)
      setTimeout(() => {
        this.bruteForceAttempts.delete(key);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Detect rate limit violations
   */
  private async detectRateLimitViolation(event: SecurityEvent): Promise<void> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 100; // Max requests per minute

    if (!this.rateLimitMap.has(event.ip)) {
      this.rateLimitMap.set(event.ip, []);
    }

    const requests = this.rateLimitMap.get(event.ip)!;
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
    recentRequests.push(now);
    
    this.rateLimitMap.set(event.ip, recentRequests);

    if (recentRequests.length > maxRequests) {
      await this.logSecurityEvent({
        eventType: SecurityEventType.API_ABUSE,
        severity: SecuritySeverity.MEDIUM,
        outcome: 'warning',
        details: {
          ...event.details,
          requestCount: recentRequests.length,
          timeWindow: '1 minute',
          threshold: maxRequests
        },
        risk_score: 6.0
      });
    }
  }

  /**
   * Detect injection attempts
   */
  private async detectInjectionAttempts(event: SecurityEvent): Promise<void> {
    const suspiciousPatterns = [
      // SQL Injection
      /(union|select|insert|update|delete|drop|create|alter)\s+/gi,
      /(\b|'|\")or(\b|'|\")\s*\d+\s*=\s*\d+/gi,
      /';\s*(drop|delete|update|insert)/gi,
      
      // XSS
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      
      // Command Injection
      /;.*?\b(cat|ls|pwd|whoami|id|uname)\b/gi,
      /\|\s*(cat|ls|pwd|whoami)/gi,
      
      // Path Traversal
      /\.\.\/.*\.\./gi,
      /%2e%2e%2f/gi,
      
      // LDAP Injection
      /\(\|\(/gi,
      /\(\&\(/gi
    ];

    const content = JSON.stringify({
      query: event.details.query,
      body: event.details.body,
      params: event.details.params
    });

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        await this.logSecurityEvent({
          eventType: SecurityEventType.INJECTION_ATTEMPT,
          severity: SecuritySeverity.HIGH,
          outcome: 'failure',
          details: {
            ...event.details,
            pattern: pattern.source,
            suspiciousContent: content.substring(0, 500)
          },
          risk_score: 8.5
        });
        break;
      }
    }
  }

  /**
   * Detect anomalous behavior patterns
   */
  private async detectAnomalousBehavior(event: SecurityEvent): Promise<void> {
    // Detect unusual user agent strings
    if (this.isAnomalousUserAgent(event.userAgent)) {
      await this.logSecurityEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.MEDIUM,
        outcome: 'warning',
        details: {
          ...event.details,
          anomaly: 'unusual_user_agent',
          userAgent: event.userAgent
        },
        risk_score: 5.0
      });
    }

    // Detect bot-like behavior
    if (this.isBotLikeBehavior(event)) {
      await this.logSecurityEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.MEDIUM,
        outcome: 'warning',
        details: {
          ...event.details,
          anomaly: 'bot_like_behavior'
        },
        risk_score: 6.0
      });
    }
  }

  /**
   * Detect geographic anomalies
   */
  private async detectGeographicAnomalies(event: SecurityEvent): Promise<void> {
    if (!event.geolocation || !event.userId) return;

    // Check if user is accessing from a significantly different location
    // This would require storing user's typical locations in database
    // For now, we'll flag access from high-risk countries

    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    if (event.geolocation.country && highRiskCountries.includes(event.geolocation.country)) {
      await this.logSecurityEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecuritySeverity.MEDIUM,
        outcome: 'warning',
        details: {
          ...event.details,
          anomaly: 'high_risk_country',
          country: event.geolocation.country
        },
        risk_score: 5.5
      });
    }
  }

  /**
   * Detect session anomalies
   */
  private async detectSessionAnomalies(event: SecurityEvent): Promise<void> {
    // Detect concurrent sessions from different locations
    // Detect session hijacking attempts
    // This would require session tracking in database
    
    if (event.details.sessionConcurrency > 3) {
      await this.logSecurityEvent({
        eventType: SecurityEventType.SESSION_ANOMALY,
        severity: SecuritySeverity.HIGH,
        outcome: 'warning',
        details: {
          ...event.details,
          anomaly: 'multiple_concurrent_sessions'
        },
        risk_score: 7.0
      });
    }
  }

  /**
   * Send event to Splunk
   */
  private async sendToSplunk(event: SecurityEvent): Promise<void> {
    if (!this.siemEndpoints.splunk) return;

    try {
      await axios.post(this.siemEndpoints.splunk, {
        event: {
          ...event,
          index: 'receipt_vault_security',
          sourcetype: 'security_event'
        }
      }, {
        headers: {
          'Authorization': `Splunk ${process.env.SPLUNK_HEC_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to send event to Splunk', { error: error.message });
    }
  }

  /**
   * Send event to Elasticsearch
   */
  private async sendToElastic(event: SecurityEvent): Promise<void> {
    if (!this.siemEndpoints.elastic) return;

    try {
      const index = `receipt-vault-security-${new Date().toISOString().slice(0, 7)}`;
      await axios.post(`${this.siemEndpoints.elastic}/${index}/_doc`, event, {
        headers: {
          'Authorization': `ApiKey ${process.env.ELASTICSEARCH_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to send event to Elasticsearch', { error: error.message });
    }
  }

  /**
   * Send event to Azure Sentinel
   */
  private async sendToSentinel(event: SecurityEvent): Promise<void> {
    if (!this.siemEndpoints.sentinel) return;

    try {
      await axios.post(this.siemEndpoints.sentinel, [event], {
        headers: {
          'Authorization': `Bearer ${process.env.AZURE_SENTINEL_TOKEN}`,
          'Content-Type': 'application/json',
          'Log-Type': 'ReceiptVaultSecurityEvent'
        },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to send event to Azure Sentinel', { error: error.message });
    }
  }

  /**
   * Send event to Sumo Logic
   */
  private async sendToSumoLogic(event: SecurityEvent): Promise<void> {
    if (!this.siemEndpoints.sumo) return;

    try {
      await axios.post(this.siemEndpoints.sumo, event, {
        headers: {
          'X-Sumo-Category': 'receipt-vault/security',
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to send event to Sumo Logic', { error: error.message });
    }
  }

  /**
   * Send event to Datadog
   */
  private async sendToDatadog(event: SecurityEvent): Promise<void> {
    if (!this.siemEndpoints.datadog) return;

    try {
      await axios.post(this.siemEndpoints.datadog, {
        ddsource: 'receipt-vault',
        ddtags: `env:${process.env.NODE_ENV},service:receipt-vault-backend`,
        hostname: process.env.HOSTNAME || 'unknown',
        message: JSON.stringify(event),
        service: 'receipt-vault-security'
      }, {
        headers: {
          'DD-API-KEY': process.env.DATADOG_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to send event to Datadog', { error: error.message });
    }
  }

  /**
   * Utility methods
   */
  private generateEventId(): string {
    return `rv_sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRiskScore(event: Partial<SecurityEvent>): number {
    let score = 1.0;

    // Base score by event type
    const eventScores = {
      [SecurityEventType.AUTHENTICATION_FAILURE]: 3.0,
      [SecurityEventType.BRUTE_FORCE_ATTEMPT]: 8.0,
      [SecurityEventType.INJECTION_ATTEMPT]: 9.0,
      [SecurityEventType.PRIVILEGE_ESCALATION]: 9.5,
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: 5.0,
      [SecurityEventType.API_ABUSE]: 6.0
    };

    if (event.eventType && eventScores[event.eventType]) {
      score = eventScores[event.eventType];
    }

    // Adjust based on severity
    const severityMultipliers = {
      [SecuritySeverity.LOW]: 0.5,
      [SecuritySeverity.MEDIUM]: 1.0,
      [SecuritySeverity.HIGH]: 1.5,
      [SecuritySeverity.CRITICAL]: 2.0
    };

    if (event.severity && severityMultipliers[event.severity]) {
      score *= severityMultipliers[event.severity];
    }

    return Math.min(10.0, score);
  }

  private async getGeolocation(ip: string): Promise<SecurityEvent['geolocation']> {
    try {
      // Use a geolocation service (implement with your preferred provider)
      // For now, return a placeholder
      return {
        country: 'US',
        region: 'Unknown',
        city: 'Unknown'
      };
    } catch (error) {
      return undefined;
    }
  }

  private parseUserAgent(userAgent: string): SecurityEvent['device_info'] {
    // Simple user agent parsing (consider using a library like ua-parser-js)
    return {
      type: userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      os: this.extractOS(userAgent),
      browser: this.extractBrowser(userAgent)
    };
  }

  private extractOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    return sanitized;
  }

  private isAnomalousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /curl|wget|python|go-http|java/i,
      /bot|crawler|spider|scraper/i,
      /scanner|exploit|attack/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private isBotLikeBehavior(event: SecurityEvent): boolean {
    // Check for bot-like patterns
    const botIndicators = [
      event.details.requestTime && event.details.requestTime < 100, // Very fast requests
      event.userAgent.length < 10, // Very short user agent
      !event.details.referer, // No referer header
      event.details.requestCount && event.details.requestCount > 50 // High request volume
    ];

    return botIndicators.filter(Boolean).length >= 2;
  }
}

export const siemService = new SIEMIntegrationService();

// Middleware to automatically log security events
export const securityEventLogger = () => {
  return async (request: any, reply: any, next: any) => {
    const startTime = Date.now();

    reply.addHook('onSend', async () => {
      const responseTime = Date.now() - startTime;
      
      // Log authentication events
      if (request.url.includes('/auth/') || request.url.includes('/login')) {
        await siemService.logSecurityEvent({
          eventType: reply.statusCode === 200 ? 
            SecurityEventType.AUTHENTICATION_SUCCESS : 
            SecurityEventType.AUTHENTICATION_FAILURE,
          severity: reply.statusCode === 200 ? SecuritySeverity.LOW : SecuritySeverity.MEDIUM,
          outcome: reply.statusCode === 200 ? 'success' : 'failure',
          details: {
            endpoint: request.url,
            method: request.method,
            statusCode: reply.statusCode,
            responseTime
          }
        }, request);
      }

      // Log data access events
      if (request.method !== 'GET' && reply.statusCode < 400) {
        await siemService.logSecurityEvent({
          eventType: SecurityEventType.DATA_MODIFICATION,
          severity: SecuritySeverity.LOW,
          outcome: 'success',
          details: {
            endpoint: request.url,
            method: request.method,
            statusCode: reply.statusCode,
            responseTime
          }
        }, request);
      }

      // Log suspicious high response times
      if (responseTime > 10000) {
        await siemService.logSecurityEvent({
          eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
          severity: SecuritySeverity.MEDIUM,
          outcome: 'warning',
          details: {
            anomaly: 'high_response_time',
            responseTime,
            endpoint: request.url
          }
        }, request);
      }
    });

    next();
  };
};
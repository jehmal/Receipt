import winston from 'winston';
import config from '../config/index';

// Enhanced logger with security-specific capabilities
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
  ),
  defaultMeta: { 
    service: 'receipt-vault-api',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Security-specific log file
    new winston.transports.File({ 
      filename: 'logs/security.log',
      level: 'warn',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({ label: 'SECURITY' }),
        winston.format.json()
      )
    }),
    // Audit log for compliance
    new winston.transports.File({ 
      filename: 'logs/audit.log',
      maxsize: 10485760, // 10MB
      maxFiles: 20,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({ label: 'AUDIT' }),
        winston.format.json()
      )
    })
  ],
});

if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Enhanced logger interface with security methods
interface EnhancedLogger extends winston.Logger {
  security: (message: string, meta?: any) => void;
  audit: (message: string, meta?: any) => void;
  performance: (message: string, meta?: any) => void;
  business: (message: string, meta?: any) => void;
}

// Add custom log methods
const enhancedLogger = logger as EnhancedLogger;

enhancedLogger.security = function(message: string, meta: any = {}) {
  this.warn(message, {
    ...meta,
    logType: 'security',
    timestamp: new Date().toISOString(),
    severity: meta.severity || 'medium'
  });
};

enhancedLogger.audit = function(message: string, meta: any = {}) {
  this.info(message, {
    ...meta,
    logType: 'audit',
    timestamp: new Date().toISOString(),
    compliance: true
  });
};

enhancedLogger.performance = function(message: string, meta: any = {}) {
  this.info(message, {
    ...meta,
    logType: 'performance',
    timestamp: new Date().toISOString()
  });
};

enhancedLogger.business = function(message: string, meta: any = {}) {
  this.info(message, {
    ...meta,
    logType: 'business',
    timestamp: new Date().toISOString()
  });
};

export { enhancedLogger as logger };
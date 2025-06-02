import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

export interface JWTPayload {
  sub: string; // user id
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId?: string;
  deviceId?: string;
  sessionId: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface DeviceInfo {
  name?: string;
  type?: string;
  fingerprint?: string;
  userAgent?: string;
  ip?: string;
}

class JWTService {
  private privateKey: string;
  private publicKey: string;
  private readonly algorithm = 'RS256';
  private readonly issuer = 'receipt-vault';
  private readonly accessTokenTTL = 15 * 60; // 15 minutes
  private readonly refreshTokenTTL = 30 * 24 * 60 * 60; // 30 days

  constructor() {
    this.initializeKeys();
  }

  private initializeKeys(): void {
    try {
      // Try to load existing keys
      const keyDir = path.join(process.cwd(), 'keys');
      const privateKeyPath = path.join(keyDir, 'jwt-private.pem');
      const publicKeyPath = path.join(keyDir, 'jwt-public.pem');

      if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
        this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        this.publicKey = fs.readFileSync(publicKeyPath, 'utf8');
      } else {
        // Generate new RSA key pair
        this.generateKeyPair();
      }
    } catch (error) {
      // Fallback to environment variable or default secret
      const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
      this.privateKey = secret;
      this.publicKey = secret;
      console.warn('Using symmetric key for JWT. For production, use RSA keys.');
    }
  }

  private generateKeyPair(): void {
    const crypto = require('crypto');
    
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Create keys directory if it doesn't exist
    const keyDir = path.join(process.cwd(), 'keys');
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }

    // Save keys to files
    fs.writeFileSync(path.join(keyDir, 'jwt-private.pem'), privateKey);
    fs.writeFileSync(path.join(keyDir, 'jwt-public.pem'), publicKey);

    this.privateKey = privateKey;
    this.publicKey = publicKey;

    console.log('Generated new RSA key pair for JWT signing');
  }

  public generateTokenPair(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      companyId?: string;
    },
    deviceInfo?: DeviceInfo
  ): TokenPair {
    const sessionId = randomUUID();
    const deviceId = deviceInfo?.fingerprint || randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const basePayload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      companyId: user.companyId,
      deviceId,
      sessionId,
      iss: this.issuer,
      aud: 'receipt-vault-api'
    };

    // Access token
    const accessPayload: JWTPayload = {
      ...basePayload,
      type: 'access',
      iat: now,
      exp: now + this.accessTokenTTL,
      aud: 'receipt-vault-api'
    };

    // Refresh token
    const refreshPayload: JWTPayload = {
      ...basePayload,
      type: 'refresh',
      iat: now,
      exp: now + this.refreshTokenTTL,
      aud: 'receipt-vault-refresh'
    };

    const accessToken = this.signToken(accessPayload);
    const refreshToken = this.signToken(refreshPayload);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTTL,
      refreshExpiresIn: this.refreshTokenTTL
    };
  }

  private signToken(payload: JWTPayload): string {
    const options: jwt.SignOptions = {
      algorithm: this.algorithm as jwt.Algorithm
    };

    return jwt.sign(payload, this.privateKey, options);
  }

  public verifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): JWTPayload | null {
    try {
      const options: jwt.VerifyOptions = {
        algorithms: [this.algorithm as jwt.Algorithm],
        issuer: this.issuer,
        audience: tokenType === 'access' ? 'receipt-vault-api' : 'receipt-vault-refresh'
      };

      const payload = jwt.verify(token, this.publicKey, options) as JWTPayload;

      // Verify token type matches expected
      if (payload.type !== tokenType) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('JWT verification failed:', error.message);
      return null;
    }
  }

  public decodeTokenWithoutVerification(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  public getTokenExpiration(token: string): Date | null {
    const payload = this.decodeTokenWithoutVerification(token);
    if (!payload || !payload.exp) return null;
    
    return new Date(payload.exp * 1000);
  }

  public isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    
    return expiration < new Date();
  }

  public getPublicKey(): string {
    return this.publicKey;
  }

  public getAccessTokenTTL(): number {
    return this.accessTokenTTL;
  }

  public getRefreshTokenTTL(): number {
    return this.refreshTokenTTL;
  }
}

export const jwtService = new JWTService();
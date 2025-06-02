# 🔐 Receipt Vault Pro - Secrets Setup Guide

## ⚠️ Important Security Notice

This repository does NOT contain any actual API keys or secrets. You need to set up your own environment variables.

## 🚀 Quick Setup

1. **Copy the environment template:**
   ```bash
   cp backend/.env.template backend/.env
   ```

2. **Get your WorkOS credentials:**
   - Visit [WorkOS Dashboard](https://dashboard.workos.com/)
   - Create a new application
   - Copy your API Key and Client ID

3. **Update your `.env` file:**
   ```env
   # Replace these with your actual WorkOS credentials
   WORKOS_API_KEY=sk_test_your_actual_api_key_here
   WORKOS_CLIENT_ID=client_your_actual_client_id_here
   WORKOS_COOKIE_PASSWORD=generate-a-32-char-random-string-here
   ```

4. **Generate secure secrets:**
   ```bash
   # For WORKOS_COOKIE_PASSWORD (32 characters)
   openssl rand -base64 32

   # For JWT_SECRET (production)
   openssl rand -base64 64
   ```

## 🔧 Environment Variables Reference

### Required (WorkOS Authentication)
- `WORKOS_API_KEY` - Your WorkOS API key from dashboard
- `WORKOS_CLIENT_ID` - Your WorkOS client ID from dashboard  
- `WORKOS_COOKIE_PASSWORD` - 32+ character random string

### Optional (Enhanced Features)
- `GOOGLE_CLOUD_API_KEY` - For OCR processing with Google Vision
- `AWS_ACCESS_KEY_ID` - For S3 file storage
- `AWS_SECRET_ACCESS_KEY` - For S3 file storage

### Development (Pre-configured)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Change in production!

## 🛡️ Security Best Practices

1. **Never commit `.env` files to git**
2. **Use different secrets for each environment**
3. **Rotate secrets regularly**
4. **Use a secrets manager in production**

## 🆘 Troubleshooting

If you get authentication errors:
1. Verify your WorkOS credentials are correct
2. Check that your WorkOS application is configured properly
3. Ensure environment variables are loaded correctly

## 📚 More Information

- [WorkOS Documentation](https://workos.com/docs)
- [Receipt Vault Pro Setup Guide](./WORKOS_SETUP.md)
- [Security Best Practices](./backend/security/README.md)
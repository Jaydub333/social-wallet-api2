# Social Wallet API Specification

## Overview
Social Wallet API allows users to store social media profile data in one centralized location and enables third-party platforms to quickly onboard users with their existing social data.

## Base URL
```
https://api.socialwallet.com/v1
```

## Authentication
- **User Authentication**: JWT tokens
- **Client Authentication**: API Key + Secret
- **OAuth Flow**: Authorization code grant for third-party integrations

## Pricing Tiers
- **Basic**: $299/month - 10,000 API calls
- **Premium**: $999/month - 50,000 API calls + verification features
- **Enterprise**: $2,999/month - Unlimited calls + custom integrations

---

## User Endpoints

### POST /auth/register
Register a new user account.
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "johndoe"
}
```

### POST /auth/login
Authenticate user and receive JWT token.
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### GET /users/me
Get current user's basic information.
**Auth**: JWT Required

### PUT /users/me/profile
Update user profile information.
**Auth**: JWT Required
```json
{
  "display_name": "John Doe",
  "bio": "Software developer and entrepreneur",
  "profile_picture_url": "https://...",
  "location": "San Francisco, CA",
  "website": "https://johndoe.com",
  "birth_date": "1990-05-15"
}
```

### GET /users/me/media
Get user's uploaded media assets.
**Auth**: JWT Required

### POST /users/me/media
Upload media asset (images, videos).
**Auth**: JWT Required
**Content-Type**: multipart/form-data

### DELETE /users/me/media/:mediaId
Delete a media asset.
**Auth**: JWT Required

---

## Verification Endpoints

### POST /verify/email
Send email verification code.
**Auth**: JWT Required

### POST /verify/email/confirm
Confirm email verification with code.
**Auth**: JWT Required

### POST /verify/identity
Submit identity verification documents.
**Auth**: JWT Required

### GET /verify/status
Get user's verification status.
**Auth**: JWT Required

---

## OAuth Integration Endpoints (For Third-Party Platforms)

### GET /oauth/authorize
Initiate OAuth flow for third-party integration.
**Query Parameters**:
- `client_id`: Third-party platform's client ID
- `redirect_uri`: Callback URL
- `scope`: Requested permissions (profile, media, email, etc.)
- `state`: CSRF protection

### POST /oauth/token
Exchange authorization code for access token.
**Auth**: Client credentials (API Key + Secret)
```json
{
  "grant_type": "authorization_code",
  "code": "authorization_code_here",
  "redirect_uri": "https://platform.com/callback",
  "client_id": "client_id_here",
  "client_secret": "client_secret_here"
}
```

### POST /oauth/refresh
Refresh an expired access token.
**Auth**: Client credentials

---

## Third-Party Integration Endpoints

### GET /integration/profile
Get user's profile data for third-party platform.
**Auth**: Access Token
**Scopes**: profile

**Response**:
```json
{
  "user_id": "uuid",
  "display_name": "John Doe",
  "username": "johndoe",
  "profile_picture_url": "https://...",
  "bio": "Software developer and entrepreneur",
  "location": "San Francisco, CA",
  "website": "https://johndoe.com",
  "verified": true,
  "verification_badges": ["email", "identity", "not_scammer"]
}
```

### GET /integration/media
Get user's media assets.
**Auth**: Access Token
**Scopes**: media

### POST /integration/permissions
Request additional permissions from user.
**Auth**: Access Token

---

## Privacy & Permissions Endpoints

### GET /privacy/permissions
Get current sharing permissions.
**Auth**: JWT Required

### PUT /privacy/permissions/:clientId
Update sharing permissions for a specific client.
**Auth**: JWT Required
```json
{
  "allowed_fields": ["display_name", "profile_picture_url", "bio"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### DELETE /privacy/permissions/:clientId
Revoke all permissions for a client.
**Auth**: JWT Required

---

## Client Management Endpoints (For Platform Administrators)

### POST /clients/register
Register a new API client.
**Auth**: Admin API Key
```json
{
  "client_name": "TikTok",
  "callback_urls": ["https://tiktok.com/auth/callback"],
  "subscription_tier": "enterprise"
}
```

### GET /clients/me/usage
Get API usage statistics.
**Auth**: Client API Key

### GET /clients/me/billing
Get billing information and invoices.
**Auth**: Client API Key

---

## Webhook Endpoints

### POST /webhooks/user-updated
Notify clients when user data is updated.
**Payload**:
```json
{
  "event": "user.profile.updated",
  "user_id": "uuid",
  "client_id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "changed_fields": ["display_name", "bio"]
  }
}
```

---

## Error Responses

All endpoints return structured error responses:
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "The provided email or password is incorrect",
    "details": {}
  }
}
```

## Rate Limiting
- User endpoints: 100 requests/minute
- Client endpoints: Based on subscription tier
- OAuth endpoints: 10 requests/minute per client

## Data Retention
- User data: Retained until account deletion
- Access tokens: 1 hour expiry, 30-day refresh token
- API logs: 90 days for security auditing
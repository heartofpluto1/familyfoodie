# OAuth Setup Guide

This guide walks you through setting up Google and Facebook OAuth for the Family Foodie application.

## Prerequisites

1. Run the database migration to add OAuth support:
   ```bash
   # Apply the OAuth migration
   mysql -h localhost -u your_username -p your_database_name < docs/db/migrations/008_add_oauth_support.sql
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

## Google OAuth Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google+ API or People API

### 2. Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace)
3. Fill in required fields:
   - **App name**: Family Foodie
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Add scopes: `email`, `profile`, `openid`
5. Add test users (your email addresses)

### 3. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
5. Copy the **Client ID** and **Client Secret**

### 4. Update Environment Variables

Add to your `.env.local`:
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Facebook OAuth Setup

### 1. Create Facebook App

1. Go to [Facebook for Developers](https://developers.facebook.com)
2. Click **Create App** → **Consumer** → **Next**
3. Enter app details:
   - **App name**: Family Foodie
   - **Contact email**: Your email

### 2. Add Facebook Login Product

1. In your app dashboard, click **Add Product**
2. Find **Facebook Login** and click **Set Up**
3. Choose **Web** platform
4. Enter your site URL: `http://localhost:3000` (development)

### 3. Configure OAuth Redirect URIs

1. Go to **Facebook Login** → **Settings**
2. Add to **Valid OAuth Redirect URIs**:
   - `http://localhost:3000/api/auth/callback/facebook` (development)
   - `https://yourdomain.com/api/auth/callback/facebook` (production)

### 4. Get App Credentials

1. Go to **Settings** → **Basic**
2. Copy the **App ID** and **App Secret**

### 5. Update Environment Variables

Add to your `.env.local`:
```bash
FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
```

## NextAuth Configuration

Add to your `.env.local`:
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_key_here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

## Testing the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/auth/signin`

3. Try signing in with Google and Facebook

4. Check that:
   - User is created in the database
   - Household is automatically created
   - Session is established
   - User can access protected routes

## Troubleshooting

### Common Issues

1. **"Error: This app is blocked"**: Your Google app needs verification for production use
2. **"redirect_uri_mismatch"**: Check your redirect URIs match exactly
3. **"App Not Setup"**: Facebook app needs to be switched from Development to Live mode
4. **Database errors**: Make sure the OAuth migration ran successfully

### Development vs Production

- **Development**: Apps work with test users only
- **Production**: Google requires app verification, Facebook requires app review

### Verification Requirements

- **Google**: Submit for verification when you have real users
- **Facebook**: Submit for review to access user email addresses for all users

## Security Notes

1. Keep your client secrets secure
2. Use HTTPS in production
3. Regularly rotate your NextAuth secret
4. Monitor your OAuth app dashboards for suspicious activity
5. Consider implementing rate limiting on auth endpoints

## Next Steps

After OAuth is working:

1. Test invitation flow (Phase 2)
2. Update existing authentication middleware
3. Migrate existing password users to OAuth (optional)
4. Set up monitoring for authentication events
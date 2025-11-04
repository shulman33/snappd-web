# SendGrid Setup Guide

This guide walks you through setting up SendGrid for email delivery in your Snappd application.

## Table of Contents

1. [Create SendGrid Account](#create-sendgrid-account)
2. [Get Your API Key](#get-your-api-key)
3. [Verify Sender Identity](#verify-sender-identity)
4. [Configure Environment Variables](#configure-environment-variables)
5. [Configure Supabase SMTP](#configure-supabase-smtp)
6. [Test Email Delivery](#test-email-delivery)
7. [Optional: Create Custom Templates](#optional-create-custom-templates)
8. [Monitoring and Analytics](#monitoring-and-analytics)
9. [Troubleshooting](#troubleshooting)

---

## Create SendGrid Account

1. Go to [SendGrid.com](https://sendgrid.com)
2. Click **Start for Free** or **Sign Up**
3. Fill in your account details:
   - Email address
   - Password
   - Company name (can use personal name)
4. Complete email verification
5. Fill out the "Tell us about yourself" form:
   - Choose **Developer** as your role
   - Purpose: **Transactional Emails**
   - Number of emails: Choose based on your needs (Free tier: 100/day)
6. Complete the account setup

**Free Tier Limits:**
- 100 emails/day forever
- Perfect for development and small projects
- No credit card required

---

## Get Your API Key

1. Log in to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Settings** → **API Keys** (left sidebar)
3. Click **Create API Key** (top right)
4. Configure your API key:
   - **Name**: `Snappd Development` (or `Snappd Production`)
   - **API Key Permissions**: Choose one:
     - **Full Access** (recommended for development)
     - **Restricted Access** → Enable only **Mail Send** (recommended for production)
5. Click **Create & View**
6. **⚠️ IMPORTANT**: Copy the API key immediately
   - It starts with `SG.`
   - You won't be able to see it again
   - Store it securely (we'll add it to `.env.local` next)

**Security Best Practices:**
- Use different API keys for development and production
- Never commit API keys to version control
- Rotate keys regularly
- Use Restricted Access with minimal permissions for production

---

## Verify Sender Identity

SendGrid requires you to verify your sender email address or domain before sending emails.

### Option A: Single Sender Verification (Recommended for Development)

**Best for:** Development, testing, personal projects

1. In SendGrid Dashboard, navigate to **Settings** → **Sender Authentication**
2. Under **Sender Identity**, click **Get Started** (or **Verify a Single Sender**)
3. Click **Create New Sender**
4. Fill in the form:
   - **From Name**: `Snappd` (or your app name)
   - **From Email Address**: Your email (e.g., `you@gmail.com`)
   - **Reply To**: Same as From Email (or different if needed)
   - **Company Address**: Your address (required)
   - **Company City, State, Zip**: Your location
   - **Country**: Your country
   - **Nickname**: `Snappd Development` (optional, for your reference)
5. Click **Create**
6. Check your email for verification message from SendGrid
7. Click the verification link
8. You'll see a green checkmark ✅ when verified

**Use this verified email as your `SENDGRID_FROM_EMAIL`**

### Option B: Domain Authentication (Recommended for Production)

**Best for:** Production, professional projects, custom domains

1. In SendGrid Dashboard, navigate to **Settings** → **Sender Authentication**
2. Under **Domain Authentication**, click **Get Started** (or **Authenticate Your Domain**)
3. Choose your DNS host (e.g., Cloudflare, GoDaddy, etc.)
4. Enter your domain (e.g., `snappd.app`)
5. Click **Next**
6. SendGrid will generate DNS records:
   - 3 CNAME records for domain authentication
   - 1 CNAME record for link branding (optional but recommended)
7. Copy the DNS records and add them to your DNS provider:

   **Example DNS Records:**
   ```
   Type: CNAME
   Name: em1234._domainkey.snappd.app
   Value: em1234.dkim.sendgrid.net

   Type: CNAME
   Name: s1._domainkey.snappd.app
   Value: s1.domainkey.sendgrid.net

   Type: CNAME
   Name: s2._domainkey.snappd.app
   Value: s2.domainkey.sendgrid.net
   ```

8. Wait for DNS propagation (can take up to 48 hours, usually much faster)
9. Click **Verify** in SendGrid Dashboard
10. Once verified, you can use any email from your domain (e.g., `noreply@snappd.app`)

**Benefits of Domain Authentication:**
- Better email deliverability
- Professional sender email addresses
- Avoid "sent via sendgrid.net" warnings
- Custom link branding

---

## Configure Environment Variables

1. Open your project's `.env.local` file (create it if it doesn't exist):
   ```bash
   cp .env.example .env.local
   ```

2. Add/update the following variables:
   ```env
   # SendGrid Configuration
   SENDGRID_API_KEY=SG.your-actual-api-key-here
   SENDGRID_FROM_EMAIL=your-verified-email@example.com
   SENDGRID_FROM_NAME=Snappd
   ```

3. Replace the values:
   - `SENDGRID_API_KEY`: The API key you copied earlier
   - `SENDGRID_FROM_EMAIL`: Your verified sender email
   - `SENDGRID_FROM_NAME`: Your app name (appears in "From" field)

4. Save the file

**Example `.env.local`:**
```env
# Development example with single sender
SENDGRID_API_KEY=SG.abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
SENDGRID_FROM_EMAIL=dev@example.com
SENDGRID_FROM_NAME=Snappd Dev

# Production example with authenticated domain
SENDGRID_API_KEY=SG.xyz789abc456def123ghi890jkl567mno234pqr901stu678vw
SENDGRID_FROM_EMAIL=noreply@snappd.app
SENDGRID_FROM_NAME=Snappd
```

**⚠️ Security Reminder:**
- `.env.local` is in `.gitignore` - never commit it
- Never share your API key
- Use different keys for different environments

---

## Configure Supabase SMTP

To route Supabase Auth emails (signup, password reset, magic links) through SendGrid:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **shulman33's Project** (`iitxfjhnywekstxagump`)
3. Navigate to **Project Settings** (gear icon) → **Authentication**
4. Scroll down to **SMTP Settings**
5. Click **Enable Custom SMTP**
6. Fill in the SMTP configuration:
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: [Your SENDGRID_API_KEY]
   Sender email: [Your SENDGRID_FROM_EMAIL]
   Sender name: [Your SENDGRID_FROM_NAME]
   ```

   **Example:**
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: SG.abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
   Sender email: dev@example.com
   Sender name: Snappd
   ```

7. Click **Save**

**Important Notes:**
- Username is literally `apikey` (not your email or actual username)
- Password is your full SendGrid API key
- Use Port 587 (TLS) - do not use Port 25 or 465
- Sender email must be a verified sender in SendGrid

---

## Test Email Delivery

### Test 1: Supabase SMTP Test Email

1. In Supabase Dashboard → **Authentication** → **Email Templates**
2. Select any template (e.g., "Confirm signup")
3. Click **Send test email** (bottom of the page)
4. Enter your email address
5. Click **Send**
6. Check your inbox for the test email

**If successful:** You'll receive the email within seconds

**If failed:** Check the [Troubleshooting](#troubleshooting) section

### Test 2: Verify in SendGrid Dashboard

1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Activity** (left sidebar)
3. You should see the test email in the activity feed
4. Click on it to see delivery details:
   - Status: Delivered
   - Opens, clicks (if applicable)
   - Bounce/block reasons (if failed)

### Test 3: Test Signup Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/signup`
3. Create a test account with a real email you can access
4. Check your email for verification link
5. Verify the email rendered correctly
6. Click the verification link to complete signup

### Test 4: Test Custom Email Service (Optional)

Create a test script: `scripts/test-email.ts`

```typescript
import { SendGridEmailService } from '../src/lib/email/sendgrid';

async function testEmail() {
  try {
    await SendGridEmailService.sendWelcomeEmail(
      'your-email@example.com',
      {
        userName: 'Test User',
        appName: 'Snappd',
        dashboardUrl: 'http://localhost:3000/dashboard'
      }
    );
    console.log('✅ Email sent successfully!');
  } catch (error) {
    console.error('❌ Email failed:', error);
  }
}

testEmail();
```

Run it:
```bash
npx tsx scripts/test-email.ts
```

---

## Optional: Create Custom Templates

For custom-branded emails, create dynamic templates in SendGrid.

### Create a Template

1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Email API** → **Dynamic Templates**
3. Click **Create a Dynamic Template**
4. Name your template (e.g., "Email Verification")
5. Click **Add Version**
6. Choose an editor:
   - **Code Editor** (recommended for developers)
   - **Design Editor** (visual drag-and-drop)

### Example: Email Verification Template

**Template Name:** `Email Verification`
**Subject:** `Verify Your Email - {{appName}}`

**HTML Content:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button {
      background-color: #4F46E5;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      display: inline-block;
    }
    .footer { color: #666; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h1 style="color: #4F46E5;">Verify Your Email</h1>
    <p>Thanks for signing up for {{appName}}!</p>
    <p>Please click the button below to verify your email address:</p>
    <div style="margin: 30px 0;">
      <a href="{{confirmationUrl}}" class="button">Verify Email Address</a>
    </div>
    <p class="footer">
      If the button doesn't work, copy and paste this link:<br>
      <a href="{{confirmationUrl}}">{{confirmationUrl}}</a>
    </p>
    <p class="footer">This link expires in 24 hours.</p>
  </div>
</body>
</html>
```

**Template Variables:**
- `{{appName}}` - Your app name
- `{{confirmationUrl}}` - Verification link

### Get Template ID

1. After saving the template, you'll see a **Template ID**
2. Format: `d-xxxxxxxxxxxxx`
3. Copy this ID

### Use Template in Code

Update your environment variables:
```env
SENDGRID_TEMPLATE_EMAIL_VERIFICATION=d-abc123def456
SENDGRID_TEMPLATE_PASSWORD_RESET=d-def456ghi789
SENDGRID_TEMPLATE_MAGIC_LINK=d-ghi789jkl012
```

Use in your code:
```typescript
await SendGridEmailService.sendEmailVerification(
  'user@example.com',
  {
    confirmationUrl: 'https://snappd.app/verify?token=abc123',
    appName: 'Snappd'
  },
  process.env.SENDGRID_TEMPLATE_EMAIL_VERIFICATION // Template ID
);
```

### Create All Templates

Recommended templates to create:
1. ✉️ Email Verification
2. 🔒 Password Reset
3. 🔗 Magic Link
4. 👋 Welcome Email
5. 📸 Screenshot Shared

---

## Monitoring and Analytics

### SendGrid Dashboard

1. Navigate to **Activity** to see real-time email events:
   - Processed
   - Delivered
   - Opened
   - Clicked
   - Bounced
   - Spam reports

2. Navigate to **Statistics** for analytics:
   - Delivery rates
   - Open rates
   - Click rates
   - Bounce rates
   - Geographic data

### Email Categories

Emails sent via the `SendGridEmailService` are automatically categorized:
- `email-verification`
- `password-reset`
- `magic-link`
- `welcome`
- `screenshot-shared`

Use categories to filter activity and statistics in SendGrid Dashboard.

### Webhooks (Advanced)

Set up webhooks to receive real-time email events:

1. Go to **Settings** → **Mail Settings** → **Event Webhook**
2. Enable Event Notification
3. HTTP Post URL: `https://yourdomain.com/api/webhooks/sendgrid`
4. Select events to track:
   - ✅ Delivered
   - ✅ Opened
   - ✅ Clicked
   - ✅ Bounced
   - ✅ Spam Report
5. Save

Implement webhook handler in your app to track email analytics in your database.

---

## Troubleshooting

### Problem: "Forbidden - Sender identity is not verified"

**Cause:** Trying to send from an unverified email address

**Solution:**
1. Verify your sender email in SendGrid Dashboard → Settings → Sender Authentication
2. Update `SENDGRID_FROM_EMAIL` to use the verified email
3. Restart your application

---

### Problem: "Unauthorized - Invalid API Key"

**Cause:** Wrong or expired API key

**Solution:**
1. Verify the API key in `.env.local` starts with `SG.`
2. Check for extra spaces or line breaks
3. Generate a new API key in SendGrid Dashboard
4. Update `.env.local` with the new key
5. Restart your application

---

### Problem: Emails Not Arriving

**Cause:** Multiple possible reasons

**Solution:**
1. Check spam/junk folder
2. Verify in SendGrid Dashboard → Activity that email was sent
3. Check SendGrid → Activity for delivery status:
   - **Delivered**: Check spam folder
   - **Bounced**: Email address invalid
   - **Dropped**: Sender not verified or rate limit exceeded
   - **Deferred**: Temporary issue, will retry
4. Verify DNS records if using domain authentication
5. Check email address is correct
6. Try sending to a different email address

---

### Problem: "Connection refused" or "SMTP error"

**Cause:** Incorrect SMTP configuration

**Solution:**
1. Verify SMTP settings in Supabase Dashboard:
   - Host: `smtp.sendgrid.net` (no `https://`)
   - Port: `587` (not 25 or 465)
   - Username: `apikey` (literally)
   - Password: Your full API key
2. Check firewall/network restrictions
3. Try regenerating API key

---

### Problem: Template Not Rendering

**Cause:** Template ID incorrect or missing variables

**Solution:**
1. Verify template ID is correct (format: `d-xxxxxxxxxxxxx`)
2. Check all required template variables are provided
3. Test template in SendGrid Dashboard → Dynamic Templates → Preview
4. Check template is Active (not Draft)

---

### Problem: Rate Limit Exceeded

**Cause:** Free tier limit (100 emails/day) reached

**Solution:**
1. Check SendGrid Dashboard → Statistics for email count
2. Upgrade to paid plan if needed:
   - Essentials: $20/month for 50,000 emails
   - Pro: $90/month for 100,000 emails
3. Optimize email sending in development (use console logging instead)
4. Implement email queueing for high-volume needs

---

### Problem: High Bounce Rate

**Cause:** Invalid email addresses or poor sender reputation

**Solution:**
1. Validate email addresses before sending
2. Implement double opt-in for signups
3. Remove bounced addresses from your list
4. Authenticate your domain
5. Monitor SendGrid Reputation Dashboard

---

## Additional Resources

- [SendGrid Documentation](https://docs.sendgrid.com)
- [SendGrid Node.js Library](https://github.com/sendgrid/sendgrid-nodejs)
- [Email Best Practices](https://sendgrid.com/blog/email-best-practices/)
- [Supabase SMTP Setup](https://supabase.com/docs/guides/auth/auth-smtp)
- [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md)

---

## Getting Help

**SendGrid Support:**
- Free tier: Email support, community forum
- Paid tiers: Email and chat support
- [SendGrid Support Center](https://support.sendgrid.com)

**Supabase Support:**
- [Supabase Discord](https://discord.supabase.com)
- [Supabase Documentation](https://supabase.com/docs)

**Project Issues:**
- Check the project README
- Review existing GitHub issues
- Contact the development team

---

## Next Steps

After setting up SendGrid:

1. ✅ Test all email flows (signup, reset password, magic link)
2. ✅ Create custom email templates for branding
3. ✅ Set up email event webhooks for analytics
4. ✅ Monitor deliverability in SendGrid Dashboard
5. ✅ Plan for scaling (upgrade plan if needed)
6. ✅ Implement email preferences/unsubscribe (if sending marketing emails)

Happy emailing! 📧

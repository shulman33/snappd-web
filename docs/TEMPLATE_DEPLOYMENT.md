# SendGrid Template Deployment Guide

This guide walks you through deploying custom email templates to SendGrid for a professional, branded email experience.

## Quick Start

**Time Required:** 20-30 minutes
**Skill Level:** Beginner-friendly

## Prerequisites

Before you begin:

- ✅ SendGrid account created
- ✅ SendGrid API key configured in `.env.local`
- ✅ Sender email verified in SendGrid
- ✅ Basic understanding of email templates

If you haven't set up SendGrid yet, follow [docs/SENDGRID_SETUP.md](./SENDGRID_SETUP.md) first.

---

## Step-by-Step Deployment

### Step 1: Review Available Templates

Navigate to the `email-templates/` directory:

```bash
cd email-templates/
ls -la
```

You should see:
- `email-verification.html` - Email verification (signup)
- `password-reset.html` - Password reset
- `magic-link.html` - Magic link authentication
- `welcome.html` - Welcome email after signup
- `screenshot-shared.html` - Screenshot sharing notification
- `README.md` - Template documentation

### Step 2: Log In to SendGrid

1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Sign in with your credentials
3. Verify you're in the correct account

### Step 3: Navigate to Dynamic Templates

1. In the left sidebar, click **Email API**
2. Click **Dynamic Templates**
3. You'll see a list of existing templates (or empty if first time)

### Step 4: Create Your First Template (Email Verification)

#### 4.1 Create Template

1. Click **Create a Dynamic Template** (top right)
2. Template Name: `Email Verification`
3. Click **Create**

#### 4.2 Add Version

1. Click **Add Version** in the template you just created
2. Choose **Code Editor** (recommended)
3. You'll see three tabs: Design, Code, Test

#### 4.3 Configure Subject Line

1. At the top, find **Subject** field
2. Enter: `Verify Your Email - Snappd`
3. You can use variables like: `Verify Your Email - {{appName}}`

#### 4.4 Upload Template Code

1. Click the **Code** tab
2. Open `email-templates/email-verification.html` on your computer
3. Select all content (Cmd+A or Ctrl+A)
4. Copy (Cmd+C or Ctrl+C)
5. Back in SendGrid, select all existing code in the editor
6. Paste your template code (Cmd+V or Ctrl+V)

#### 4.5 Test the Template

1. Click **Test Data** in the left sidebar
2. Replace the JSON with:

```json
{
  "confirmationUrl": "https://snappd.app/verify?token=abc123def456",
  "appUrl": "https://snappd.app",
  "year": "2025"
}
```

3. Click **Preview** tab to see how it looks
4. Check both desktop and mobile previews

#### 4.6 Send Test Email

1. In the **Test Data** section, click **Send Test**
2. Enter your email address
3. Click **Send**
4. Check your inbox (and spam folder)
5. Verify the email looks correct

#### 4.7 Save Template

1. Click **Save** (top right)
2. Version name: `v1.0` or leave default
3. Click **Save** again to confirm

#### 4.8 Get Template ID

1. After saving, you'll see **Template ID** at the top
2. Format: `d-xxxxxxxxxxxxx`
3. Click the copy icon or manually copy
4. Save this ID - you'll need it later

### Step 5: Repeat for Remaining Templates

Repeat Step 4 for each template:

| Template File | Template Name | Subject Line | Test Variables |
|--------------|---------------|--------------|----------------|
| `password-reset.html` | Password Reset | `Reset Your Password - Snappd` | See below ⬇️ |
| `magic-link.html` | Magic Link | `Your Login Link - Snappd` | See below ⬇️ |
| `welcome.html` | Welcome Email | `Welcome to Snappd!` | See below ⬇️ |
| `screenshot-shared.html` | Screenshot Shared | `Someone Shared a Screenshot with You` | See below ⬇️ |

#### Password Reset Test Data

```json
{
  "resetUrl": "https://snappd.app/reset-password?token=xyz789",
  "appUrl": "https://snappd.app",
  "expiryHours": "1",
  "year": "2025"
}
```

#### Magic Link Test Data

```json
{
  "loginUrl": "https://snappd.app/auth/callback?token=def456",
  "appUrl": "https://snappd.app",
  "expiryMinutes": "60",
  "year": "2025"
}
```

#### Welcome Email Test Data

```json
{
  "userName": "John Doe",
  "dashboardUrl": "https://snappd.app/dashboard",
  "appUrl": "https://snappd.app",
  "year": "2025"
}
```

#### Screenshot Shared Test Data

```json
{
  "screenshotUrl": "https://snappd.app/s/abc123",
  "sharedBy": "Jane Smith",
  "senderInitial": "J",
  "message": "Check out this screenshot!",
  "appUrl": "https://snappd.app",
  "year": "2025"
}
```

### Step 6: Configure Environment Variables

1. Open `.env.local` in your project root
2. Add the template IDs you copied:

```env
# SendGrid Dynamic Template IDs
SENDGRID_TEMPLATE_EMAIL_VERIFICATION=d-abc123def456
SENDGRID_TEMPLATE_PASSWORD_RESET=d-def456ghi789
SENDGRID_TEMPLATE_MAGIC_LINK=d-ghi789jkl012
SENDGRID_TEMPLATE_WELCOME=d-jkl012mno345
SENDGRID_TEMPLATE_SCREENSHOT_SHARED=d-mno345pqr678
```

3. Save the file
4. Restart your development server:

```bash
npm run dev
```

### Step 7: Test Templates in Your App

#### 7.1 Test Email Verification

1. Go to `http://localhost:3000/signup`
2. Create a new account with a real email
3. Check your email for verification
4. Verify the template is used correctly

#### 7.2 Test Password Reset

1. Go to `http://localhost:3000/reset-password`
2. Enter your email
3. Check your email for reset link
4. Verify the template renders correctly

#### 7.3 Test Magic Link

1. Go to `http://localhost:3000/login`
2. Click "Sign in with Magic Link"
3. Enter your email
4. Check your email for magic link
5. Verify the template works

#### 7.4 Test Welcome Email (Manual)

Create a test script: `scripts/test-welcome-email.ts`

```typescript
import { SendGridEmailService } from '../src/lib/email/sendgrid';

async function testWelcomeEmail() {
  try {
    await SendGridEmailService.sendWelcomeEmail(
      'your-email@example.com',
      {
        userName: 'Test User',
        appName: 'Snappd',
        dashboardUrl: 'http://localhost:3000/dashboard'
      },
      process.env.SENDGRID_TEMPLATE_WELCOME
    );
    console.log('✅ Welcome email sent!');
  } catch (error) {
    console.error('❌ Failed:', error);
  }
}

testWelcomeEmail();
```

Run it:

```bash
npx tsx scripts/test-welcome-email.ts
```

---

## Customization

### Changing Colors

To match your brand, edit the template HTML files:

1. Find this line in each template:
   ```css
   background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
   ```

2. Change to your brand colors:
   ```css
   background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
   ```

3. Find accent color `#4f46e5` and replace throughout

4. Re-upload to SendGrid (create new version)

### Adding Your Logo

Replace the emoji logo with your brand logo:

1. In each template, find:
   ```html
   <a href="{{appUrl}}" class="email-logo">📸 Snappd</a>
   ```

2. Replace with:
   ```html
   <a href="{{appUrl}}">
     <img src="https://yourdomain.com/logo.png"
          alt="Your Brand"
          style="height: 40px;">
   </a>
   ```

3. Upload logo to a CDN or your website
4. Update all templates
5. Re-upload to SendGrid

### Customizing Footer Links

Update footer in each template:

```html
<p class="footer-text">
  <a href="{{appUrl}}/privacy" class="footer-link">Privacy</a> •
  <a href="{{appUrl}}/terms" class="footer-link">Terms</a> •
  <a href="{{appUrl}}/help" class="footer-link">Help</a>
</p>
```

---

## Troubleshooting

### Template Not Found Error

**Issue**: `Template ID not found`

**Solution**:
1. Check template ID in `.env.local` is correct
2. Verify template is Active (not Draft) in SendGrid
3. Ensure no extra spaces in template ID
4. Restart your dev server after changing `.env.local`

### Variables Not Rendering

**Issue**: Email shows `{{variableName}}` instead of actual value

**Solution**:
1. Check variable names match exactly (case-sensitive)
2. Verify all required variables are passed in `dynamicTemplateData`
3. Test with SendGrid preview using test data

### Template Looks Broken

**Issue**: Layout broken or styling missing

**Solution**:
1. Ensure you copied entire HTML file (including `<html>` and `<head>` tags)
2. Use Code Editor, not Design Editor
3. Check for copy-paste errors
4. Re-copy from source file

### SendGrid Rejects Template

**Issue**: "Template validation failed"

**Solution**:
1. Check for missing closing tags
2. Verify all CSS is inline
3. Remove any `<script>` tags (not allowed)
4. Check email size is under 102KB

---

## Version Management

### Creating New Versions

When updating templates:

1. Don't delete old versions immediately
2. Create a new version in SendGrid:
   - Go to template
   - Click **Add Version**
   - Upload updated HTML
   - Test thoroughly
3. Activate new version when ready
4. Keep old version for 30 days (for rollback)

### Version Naming Convention

Use semantic versioning in version names:

- `v1.0` - Initial release
- `v1.1` - Minor updates (copy changes, small fixes)
- `v2.0` - Major redesign or new features

### Rollback Procedure

If new version has issues:

1. Go to SendGrid → Dynamic Templates
2. Select your template
3. Click on previous version
4. Click **Make Active**
5. Previous version is now live

---

## Production Deployment

### Pre-Deployment Checklist

Before deploying to production:

- [ ] All 5 templates uploaded to SendGrid
- [ ] All templates tested with test data
- [ ] Test emails sent and verified in inbox
- [ ] Templates tested in multiple email clients:
  - [ ] Gmail (web)
  - [ ] Gmail (mobile app)
  - [ ] Outlook (web)
  - [ ] Apple Mail (desktop)
  - [ ] Apple Mail (iOS)
- [ ] All links point to production URLs
- [ ] Logo and images load correctly
- [ ] Colors match brand guidelines
- [ ] Footer links work correctly
- [ ] Template IDs added to production environment variables
- [ ] Unsubscribe link added (if sending marketing emails)
- [ ] Privacy policy and terms links work

### Deploying to Production

1. **Environment Variables**: Add template IDs to your production hosting platform:
   - Vercel: Project Settings → Environment Variables
   - Netlify: Site Settings → Environment Variables
   - AWS/Other: Use secrets manager

2. **Test in Production**: After deploying, test all email flows in production

3. **Monitor**: Check SendGrid Activity dashboard for delivery status

---

## Monitoring and Analytics

### SendGrid Activity Dashboard

Monitor email performance:

1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Click **Activity**
3. View metrics:
   - Delivered
   - Opened
   - Clicked
   - Bounced
   - Spam reports

### Email Analytics

Track template performance:

1. Navigate to **Statistics** → **Overview**
2. Filter by category (templates auto-tagged by category)
3. View metrics:
   - Delivery rate
   - Open rate
   - Click rate
   - Engagement over time

### Setting Up Alerts

Get notified of issues:

1. Go to **Settings** → **Alerts**
2. Create alerts for:
   - High bounce rate (> 5%)
   - High spam reports (> 0.1%)
   - Failed deliveries

---

## Best Practices

### Template Maintenance

- ✅ Keep templates simple and focused
- ✅ Test in dark mode
- ✅ Use web-safe fonts
- ✅ Keep file size under 100KB
- ✅ Include alt text for images
- ✅ Test on mobile devices
- ✅ Version control your HTML files

### Email Deliverability

- ✅ Authenticate your domain
- ✅ Avoid spam trigger words
- ✅ Include unsubscribe option (marketing emails)
- ✅ Monitor bounce rates
- ✅ Clean invalid emails from lists
- ✅ Use consistent "From" address

### A/B Testing

Test template effectiveness:

1. Create two versions (A and B)
2. Send to 50/50 split of users
3. Measure open rates and click rates
4. Choose winning template
5. Update production version

---

## Next Steps

After deploying templates:

1. ✅ Monitor delivery rates in SendGrid
2. ✅ Gather user feedback on emails
3. ✅ A/B test subject lines
4. ✅ Optimize for mobile
5. ✅ Create additional templates as needed
6. ✅ Set up email event webhooks (advanced)

---

## Resources

- [SendGrid Template Syntax](https://docs.sendgrid.com/for-developers/sending-email/using-handlebars)
- [Email Template Best Practices](https://sendgrid.com/blog/email-best-practices/)
- [Testing Email Templates](https://litmus.com)
- [Email Client CSS Support](https://www.caniemail.com)
- [Project Setup Guide](./SENDGRID_SETUP.md)
- [Template Documentation](../email-templates/README.md)

---

## Getting Help

- **Template Issues**: Check [email-templates/README.md](../email-templates/README.md)
- **SendGrid Support**: [support.sendgrid.com](https://support.sendgrid.com)
- **Project Issues**: File a GitHub issue
- **Email Best Practices**: [SendGrid Blog](https://sendgrid.com/blog)

Happy templating! 📧

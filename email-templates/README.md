# SendGrid Email Templates

This directory contains custom HTML email templates for Snappd. These templates can be uploaded to SendGrid as Dynamic Templates for professional, branded email experiences.

## Available Templates

### 1. Email Verification (`email-verification.html`)
**Purpose**: Sent when users sign up for a new account
**Subject**: `Verify Your Email Address`

**Required Variables:**
- `{{confirmationUrl}}` - The verification link
- `{{appUrl}}` - Your application URL (e.g., `https://snappd.app`)
- `{{year}}` - Current year for footer

**Features:**
- Clear call-to-action button
- Backup link for accessibility
- Security notice about expiration
- Responsive design

---

### 2. Password Reset (`password-reset.html`)
**Purpose**: Sent when users request a password reset
**Subject**: `Reset Your Password - Snappd`

**Required Variables:**
- `{{resetUrl}}` - The password reset link
- `{{appUrl}}` - Your application URL
- `{{expiryHours}}` - Hours until link expires (default: 1)
- `{{year}}` - Current year for footer

**Features:**
- Security-focused design
- Warning box for unauthorized requests
- Clear expiration notice
- Responsive design

---

### 3. Magic Link (`magic-link.html`)
**Purpose**: Sent for passwordless authentication
**Subject**: `Your Login Link - Snappd`

**Required Variables:**
- `{{loginUrl}}` - The magic link login URL
- `{{appUrl}}` - Your application URL
- `{{expiryMinutes}}` - Minutes until link expires (default: 60)
- `{{year}}` - Current year for footer

**Features:**
- Quick sign-in experience
- Security tips
- Warning for unauthorized requests
- Responsive design

---

### 4. Welcome Email (`welcome.html`)
**Purpose**: Sent after users verify their email
**Subject**: `Welcome to Snappd!`

**Required Variables:**
- `{{userName}}` - User's display name
- `{{dashboardUrl}}` - Link to user dashboard
- `{{appUrl}}` - Your application URL
- `{{year}}` - Current year for footer

**Features:**
- Feature showcase
- Quick start tips
- Social links
- Engaging onboarding content
- Responsive design

---

### 5. Screenshot Shared (`screenshot-shared.html`)
**Purpose**: Sent when someone shares a screenshot with a non-user
**Subject**: `Someone Shared a Screenshot with You`

**Required Variables:**
- `{{screenshotUrl}}` - Link to view the screenshot
- `{{sharedBy}}` - Name/email of person who shared
- `{{senderInitial}}` - First letter of sender's name (for avatar)
- `{{message}}` - Optional message from sender
- `{{appUrl}}` - Your application URL
- `{{year}}` - Current year for footer

**Features:**
- Sender identification
- Optional message display
- Screenshot preview placeholder
- Sign-up CTA for viral growth
- Responsive design

---

## How to Upload Templates to SendGrid

### Step 1: Create Template in SendGrid

1. Log in to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Email API** → **Dynamic Templates**
3. Click **Create a Dynamic Template**
4. Name your template (e.g., "Email Verification")
5. Click **Add Version**

### Step 2: Choose Editor

Select **Code Editor** (recommended for these templates)

### Step 3: Configure Template

1. **Template Name**: Give the version a name (e.g., "v1.0")
2. **Subject**: Enter the subject line with variables if needed
   - Example: `Verify Your Email - {{appName}}`
3. **Design Editor**: Click **Code Editor** tab
4. **Copy HTML**: Copy the contents of the corresponding `.html` file
5. **Paste**: Paste into the SendGrid code editor
6. **Save Template**

### Step 4: Test Template

1. Click **Test Data** in SendGrid editor
2. Add sample JSON data:

```json
{
  "confirmationUrl": "https://snappd.app/verify?token=abc123",
  "appUrl": "https://snappd.app",
  "year": "2025"
}
```

3. Click **Preview** to see how the email will look
4. Send test email to yourself

### Step 5: Get Template ID

After saving, you'll see a **Template ID** (format: `d-xxxxxxxxxxxxx`)

Copy this ID - you'll need it for your environment variables.

---

## Template Variable Reference

### Common Variables (Used in Multiple Templates)

| Variable | Description | Example |
|----------|-------------|---------|
| `{{appUrl}}` | Your application URL | `https://snappd.app` |
| `{{year}}` | Current year | `2025` |

### Email Verification Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{confirmationUrl}}` | Verification link | `https://snappd.app/verify?token=abc123` |

### Password Reset Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{resetUrl}}` | Password reset link | `https://snappd.app/reset-password?token=xyz789` |
| `{{expiryHours}}` | Hours until expiration | `1` |

### Magic Link Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{loginUrl}}` | Magic link URL | `https://snappd.app/auth/callback?token=def456` |
| `{{expiryMinutes}}` | Minutes until expiration | `60` |

### Welcome Email Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{userName}}` | User's display name | `John Doe` |
| `{{dashboardUrl}}` | Dashboard URL | `https://snappd.app/dashboard` |

### Screenshot Shared Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{screenshotUrl}}` | Screenshot view URL | `https://snappd.app/s/abc123` |
| `{{sharedBy}}` | Sender's name/email | `john@example.com` |
| `{{senderInitial}}` | First letter of sender | `J` |
| `{{message}}` | Optional message | `Check this out!` |

---

## Environment Variables Setup

After uploading all templates to SendGrid, add the template IDs to your `.env.local`:

```env
# SendGrid Dynamic Template IDs
SENDGRID_TEMPLATE_EMAIL_VERIFICATION=d-abc123def456
SENDGRID_TEMPLATE_PASSWORD_RESET=d-def456ghi789
SENDGRID_TEMPLATE_MAGIC_LINK=d-ghi789jkl012
SENDGRID_TEMPLATE_WELCOME=d-jkl012mno345
SENDGRID_TEMPLATE_SCREENSHOT_SHARED=d-mno345pqr678
```

---

## Using Templates in Code

### Example: Send Welcome Email with Template

```typescript
import { SendGridEmailService } from '@/lib/email/sendgrid';

await SendGridEmailService.sendWelcomeEmail(
  'user@example.com',
  {
    userName: 'John Doe',
    appName: 'Snappd',
    dashboardUrl: process.env.NEXT_PUBLIC_APP_URL + '/dashboard'
  },
  process.env.SENDGRID_TEMPLATE_WELCOME // Use template ID
);
```

### Example: Send with Inline HTML (No Template)

```typescript
await SendGridEmailService.sendWelcomeEmail(
  'user@example.com',
  {
    userName: 'John Doe',
    appName: 'Snappd',
    dashboardUrl: process.env.NEXT_PUBLIC_APP_URL + '/dashboard'
  }
  // No template ID = uses inline HTML from sendgrid.ts
);
```

---

## Customization Guide

### Changing Colors

The templates use a purple gradient theme. To customize:

1. **Primary Gradient**: Find this line and change colors:
   ```css
   background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
   ```

2. **Accent Color**: Change `#4f46e5` to your brand color

3. **Text Colors**:
   - Primary text: `#1f2937`
   - Secondary text: `#4b5563`
   - Muted text: `#6b7280`

### Changing Logo

Replace the emoji logo with your brand:

```html
<!-- Current -->
<a href="{{appUrl}}" class="email-logo">📸 Snappd</a>

<!-- With image -->
<a href="{{appUrl}}">
  <img src="https://snappd.app/logo.png" alt="Snappd" style="height: 40px;">
</a>
```

### Adding Footer Links

Update the footer section with your links:

```html
<p class="footer-text">
  <a href="{{appUrl}}/privacy" class="footer-link">Privacy Policy</a> •
  <a href="{{appUrl}}/terms" class="footer-link">Terms of Service</a> •
  <a href="{{appUrl}}/help" class="footer-link">Help Center</a>
</p>
```

---

## Testing Checklist

Before deploying templates to production:

- [ ] Test all templates in SendGrid preview
- [ ] Send test emails to yourself
- [ ] Check rendering in multiple email clients:
  - [ ] Gmail (web)
  - [ ] Gmail (mobile)
  - [ ] Outlook (web)
  - [ ] Apple Mail
  - [ ] Yahoo Mail
- [ ] Verify all links work correctly
- [ ] Check responsive design on mobile
- [ ] Verify all template variables render correctly
- [ ] Test dark mode appearance (if applicable)
- [ ] Check spam score using [Mail Tester](https://www.mail-tester.com)

---

## Template Maintenance

### Version Control

When updating templates:

1. Create a new version in SendGrid (don't overwrite active version)
2. Test the new version thoroughly
3. Activate the new version when ready
4. Keep old versions for rollback if needed

### Best Practices

- ✅ Keep templates simple and focused
- ✅ Use web-safe fonts (system fonts)
- ✅ Inline all CSS (done in these templates)
- ✅ Test in dark mode
- ✅ Include plain text version (SendGrid auto-generates)
- ✅ Keep email size under 102KB
- ✅ Use alt text for images
- ✅ Provide text fallback for buttons

---

## Troubleshooting

### Template Variables Not Rendering

**Issue**: Variables showing as `{{variableName}}` instead of actual values

**Solution**:
1. Check template ID is correct in `.env.local`
2. Verify `dynamicTemplateData` object has all required variables
3. Check variable names match exactly (case-sensitive)

### Images Not Loading

**Issue**: Images broken in email clients

**Solution**:
1. Use absolute URLs (not relative)
2. Host images on a CDN
3. Test image URLs directly in browser
4. Check image file size (keep under 1MB each)

### Email Landing in Spam

**Issue**: Emails going to spam folder

**Solution**:
1. Authenticate your domain in SendGrid
2. Verify sender email address
3. Avoid spam trigger words
4. Include unsubscribe link (for marketing emails)
5. Test with [Mail Tester](https://www.mail-tester.com)

### Broken Layout in Outlook

**Issue**: Layout looks broken in Outlook

**Solution**:
- These templates use table-based layout (Outlook compatible)
- Avoid CSS Grid and Flexbox
- Test in [Litmus](https://www.litmus.com) or [Email on Acid](https://www.emailonacid.com)

---

## Resources

- [SendGrid Dynamic Templates Docs](https://docs.sendgrid.com/ui/sending-email/how-to-send-an-email-with-dynamic-templates)
- [Email Client Support](https://www.caniemail.com)
- [Handlebars Syntax](https://handlebarsjs.com/guide/) (used by SendGrid)
- [Email Template Best Practices](https://sendgrid.com/blog/email-best-practices/)

---

## Support

Need help with templates?

- Check [docs/SENDGRID_SETUP.md](../docs/SENDGRID_SETUP.md) for setup instructions
- Review [SendGrid Documentation](https://docs.sendgrid.com)
- Contact SendGrid Support
- File an issue in the project repository

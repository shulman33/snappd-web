# Deploying Email Templates to Supabase Dashboard

This guide provides step-by-step instructions for deploying your custom email templates to Supabase Auth.

## Prerequisites

- ✅ SendGrid SMTP configured in Supabase (see [docs/SENDGRID_SETUP.md](../docs/SENDGRID_SETUP.md))
- ✅ Access to your Supabase Dashboard
- ✅ Refactored templates with Supabase variables (in this folder)

---

## Quick Start

### Step 1: Access Email Templates

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **shulman33's Project** (`iitxfjhnywekstxagump`)
3. Navigate to **Authentication** → **Email Templates** (left sidebar)

### Step 2: Deploy Each Template

You'll deploy 3 templates that are used by Supabase Auth:

1. **Confirm signup** ← `supabase-email-verification.html`
2. **Magic Link** ← `supabase-magic-link.html`
3. **Reset Password** ← `supabase-password-reset.html`

---

## Template 1: Confirm Signup (Email Verification)

### A. Open Template File

Open `email-templates/supabase-email-verification.html` in your editor.

### B. Copy HTML Content

1. Select all content (Cmd+A / Ctrl+A)
2. Copy (Cmd+C / Ctrl+C)

### C. Paste in Supabase Dashboard

1. In Supabase Dashboard → **Email Templates**
2. Click on **Confirm signup**
3. You'll see two fields:

**Subject Line:**
```
Verify Your Email - Snappd
```

**Message (HTML):**
- Click in the editor
- Select all existing content (Cmd+A / Ctrl+A)
- Paste your copied HTML (Cmd+V / Ctrl+V)

4. Click **Save**

### D. Send Test Email

1. Scroll to bottom of template editor
2. Click **Send test email**
3. Enter your email address
4. Click **Send**
5. Check your inbox (and spam folder)
6. Verify the email looks correct with:
   - ✅ Snappd branding
   - ✅ Purple gradient header
   - ✅ Working verification button
   - ✅ Proper styling on desktop and mobile

---

## Template 2: Magic Link

### A. Open Template File

Open `email-templates/supabase-magic-link.html` in your editor.

### B. Copy HTML Content

1. Select all content (Cmd+A / Ctrl+A)
2. Copy (Cmd+C / Ctrl+C)

### C. Paste in Supabase Dashboard

1. In Supabase Dashboard → **Email Templates**
2. Click on **Magic Link**
3. You'll see two fields:

**Subject Line:**
```
Your Login Link - Snappd
```

**Message (HTML):**
- Click in the editor
- Select all existing content
- Paste your copied HTML

4. Click **Save**

### D. Send Test Email

1. Scroll to bottom
2. Click **Send test email**
3. Enter your email
4. Check inbox
5. Verify styling and functionality

---

## Template 3: Reset Password

### A. Open Template File

Open `email-templates/supabase-password-reset.html` in your editor.

### B. Copy HTML Content

1. Select all content (Cmd+A / Ctrl+A)
2. Copy (Cmd+C / Ctrl+C)

### C. Paste in Supabase Dashboard

1. In Supabase Dashboard → **Email Templates**
2. Click on **Reset Password**
3. You'll see two fields:

**Subject Line:**
```
Reset Your Password - Snappd
```

**Message (HTML):**
- Click in the editor
- Select all existing content
- Paste your copied HTML

4. Click **Save**

### D. Send Test Email

1. Scroll to bottom
2. Click **Send test email**
3. Enter your email
4. Check inbox
5. Verify styling and functionality

---

## Template Customization Options

### Optional: Customize Subject Lines

You can use Supabase variables in subject lines:

**Basic:**
```
Verify Your Email - Snappd
```

**With user name (if available):**
```
{{ if .Data.full_name }}Hi {{ .Data.full_name }}, {{ end }}Verify Your Email
```

**With site URL:**
```
Verify Your Email - {{ .SiteURL }}
```

### Optional: Add User Metadata

If you collect user metadata during signup, you can personalize emails:

**During Signup (in your code):**
```typescript
await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      full_name: 'John Doe',
      plan: 'pro'
    }
  }
})
```

**In Email Template:**
```html
{{ if .Data.full_name }}
<h1 class="email-title">Hi {{ .Data.full_name }}, verify your email</h1>
{{ else }}
<h1 class="email-title">Verify Your Email Address</h1>
{{ end }}
```

This is already implemented in the refactored templates!

---

## Testing All Email Flows

### Test 1: Email Verification (Signup)

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/signup`
3. Create a new account with a real email
4. Check inbox for verification email
5. Verify:
   - ✅ Custom template is used
   - ✅ Styling looks correct
   - ✅ Button links work
   - ✅ Responsive on mobile

### Test 2: Password Reset

1. Navigate to `http://localhost:3000/reset-password`
2. Enter your email
3. Submit form
4. Check inbox for reset email
5. Verify:
   - ✅ Custom template is used
   - ✅ Warning boxes display correctly
   - ✅ Reset link works

### Test 3: Magic Link

1. Navigate to `http://localhost:3000/login`
2. Request magic link
3. Enter your email
4. Check inbox
5. Verify:
   - ✅ Custom template is used
   - ✅ Info boxes display correctly
   - ✅ Login link works

---

## Supabase Variables Reference

Here are all the variables available in Supabase email templates:

### Core Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ .ConfirmationURL }}` | Full confirmation URL with token | `https://project.supabase.co/auth/v1/verify?token=...` |
| `{{ .SiteURL }}` | Your app's Site URL | `http://localhost:3000` |
| `{{ .Email }}` | User's email address | `user@example.com` |
| `{{ .Token }}` | 6-digit OTP (alternative to URL) | `123456` |
| `{{ .TokenHash }}` | Hashed token for custom links | `abc123def456...` |

### User Metadata (Optional)

| Variable | Description | Set During Signup |
|----------|-------------|-------------------|
| `{{ .Data.full_name }}` | User's full name | `options.data.full_name` |
| `{{ .Data.plan }}` | User's plan | `options.data.plan` |
| `{{ .Data.* }}` | Any custom field | `options.data.*` |

### Conditional Logic

Use Go template syntax for conditions:

```html
<!-- Check if variable exists -->
{{ if .Data.full_name }}
  <p>Hi {{ .Data.full_name }}!</p>
{{ else }}
  <p>Hi there!</p>
{{ end }}

<!-- Check email -->
{{ if .Email }}
  <p>Email sent to: {{ .Email }}</p>
{{ end }}

<!-- Compare values -->
{{ if eq .Data.plan "pro" }}
  <p>Welcome to Pro!</p>
{{ else if eq .Data.plan "team" }}
  <p>Welcome to Team!</p>
{{ else }}
  <p>Welcome to Free!</p>
{{ end }}
```

---

## Troubleshooting

### Variables Show as Literal Text

**Issue:** Email displays `{{ .ConfirmationURL }}` instead of actual URL

**Solution:**
1. Ensure you're editing the **HTML** field, not the subject
2. Variables are case-sensitive: `{{ .ConfirmationURL }}` not `{{ .confirmationurl }}`
3. Click **Save** after making changes
4. Send a new test email

### Template Not Saving

**Issue:** Changes revert after clicking Save

**Solution:**
1. Check browser console for errors
2. Try a different browser
3. Make sure you're not exceeding size limits
4. Contact Supabase support if issue persists

### Email Not Received

**Issue:** Test email doesn't arrive

**Solution:**
1. Check spam/junk folder
2. Verify SMTP is configured correctly in **Settings** → **Authentication**
3. Check SendGrid Dashboard → **Activity** for delivery status
4. Verify sender email is verified in SendGrid
5. Check Supabase logs in **Logs** section

### Styling Looks Broken

**Issue:** Email doesn't look right in email client

**Solution:**
1. Ensure you copied the **entire** HTML file (including `<!DOCTYPE>` and all tags)
2. Some email clients strip certain CSS - this is normal
3. Test in multiple email clients (Gmail, Outlook, Apple Mail)
4. Check on both desktop and mobile

### Links Don't Work

**Issue:** Clicking buttons/links doesn't work

**Solution:**
1. Verify `{{ .ConfirmationURL }}` is used in the `href` attribute
2. Check that you didn't accidentally modify the variable name
3. Ensure no extra spaces around the variable
4. Test with a fresh signup/reset request

---

## Email Client Compatibility

These templates have been tested and work well with:

- ✅ Gmail (web and mobile)
- ✅ Apple Mail (macOS and iOS)
- ✅ Outlook (web and desktop)
- ✅ Yahoo Mail
- ✅ ProtonMail
- ✅ Mobile email apps (iOS Mail, Gmail app, Outlook app)

**Known Issues:**
- Outlook.com may not support some CSS gradients (fallback colors included)
- Some email scanners may pre-click links (use OTP as alternative)

---

## Advanced: Using OTP Instead of Links

If you need to avoid link pre-clicking by email scanners, use the 6-digit OTP:

### In Template

```html
<div style="text-align: center; margin: 30px 0;">
  <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">
    {{ .Token }}
  </div>
  <p style="color: #6b7280; font-size: 14px; margin-top: 10px;">
    Enter this code to verify your email
  </p>
</div>
```

### In Your App

Create a form to accept the 6-digit code and verify using:

```typescript
const { data, error } = await supabase.auth.verifyOtp({
  email: 'user@example.com',
  token: '123456', // User enters this
  type: 'email'
})
```

---

## Monitoring Email Performance

### SendGrid Dashboard

1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Activity**
3. Monitor:
   - Delivery rates
   - Open rates
   - Click rates
   - Bounce rates
   - Spam reports

### Supabase Logs

1. Go to Supabase Dashboard → **Logs**
2. Filter for auth events
3. Look for email-related errors

---

## Next Steps

After deploying templates:

1. ✅ Test all 3 email flows thoroughly
2. ✅ Check emails on desktop and mobile
3. ✅ Review in different email clients
4. ✅ Monitor SendGrid activity
5. ✅ Implement custom emails (Welcome, Screenshot Shared)
6. ✅ Set up email event webhooks (optional)
7. ✅ Create SendGrid Dynamic Templates for custom emails (optional)

---

## Summary

You've deployed:

1. ✅ **Email Verification** - Custom branded signup verification
2. ✅ **Magic Link** - Passwordless login with custom styling
3. ✅ **Password Reset** - Professional password recovery emails

All emails now:
- 🎨 Use your custom branding
- 📧 Send via SendGrid SMTP
- 📱 Work on all devices
- ✅ Support user personalization
- 🔒 Include security notices

**Welcome** and **Screenshot Shared** emails will be sent via your `SendGridEmailService` when you implement those features in your app code.

---

## Resources

- [Supabase Email Templates Docs](https://supabase.com/docs/guides/auth/auth-email-templates)
- [SendGrid Setup Guide](../docs/SENDGRID_SETUP.md)
- [Supabase + SendGrid Integration](../docs/SUPABASE_SENDGRID_TEMPLATES.md)
- [Template README](./README.md)

Need help? Check the troubleshooting section or contact support!

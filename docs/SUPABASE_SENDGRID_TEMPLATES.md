# Using SendGrid Custom Templates with Supabase Auth

This guide explains how to integrate your custom SendGrid templates with Supabase Auth emails while maintaining Supabase's authentication flows.

## Overview

Supabase Auth has built-in email templates for authentication flows. However, you have two options for using custom SendGrid templates:

1. **Option A (Recommended)**: Use SendGrid SMTP with customized Supabase email templates
2. **Option B (Advanced)**: Use SendGrid Auth Hook for complete control

This guide covers both approaches.

---

## Option A: SendGrid SMTP with Custom Templates (Recommended)

This approach uses SendGrid as your SMTP provider while customizing Supabase's email templates.

### Benefits
- ✅ Simple setup
- ✅ Maintains Supabase Auth flows
- ✅ Good deliverability via SendGrid
- ✅ Customize HTML/styling
- ✅ No additional code required

### Step 1: Configure SendGrid SMTP

Already done! You configured this in [docs/SENDGRID_SETUP.md](./SENDGRID_SETUP.md):

```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: YOUR_SENDGRID_API_KEY
```

### Step 2: Customize Supabase Email Templates

#### A. Access Email Templates

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (`iitxfjhnywekstxagump`)
3. Navigate to **Authentication** → **Email Templates**

#### B. Available Templates

You can customize these 6 templates:

| Template | When Sent | Current |
|----------|-----------|---------|
| **Confirm signup** | New user verification | Default |
| **Invite user** | Admin invites user | Default |
| **Magic Link** | Passwordless login | Default |
| **Change Email Address** | Email change verification | Default |
| **Reset Password** | Password reset request | Default |
| **Reauthentication** | Sensitive operations | Default |

#### C. Customize Each Template

For each template, you'll replace the default HTML with your custom design from `email-templates/`.

**Example: Email Verification Template**

1. Open `email-templates/email-verification.html` in your editor
2. Copy the entire HTML content
3. In Supabase Dashboard → **Email Templates** → **Confirm signup**:
   - **Subject**: `Verify Your Email - Snappd` (or use variable: `Verify Your Email - {{ .SiteURL }}`)
   - **Message (HTML)**: Paste your custom HTML

**Important Template Variables:**

Replace SendGrid variables with Supabase variables:

| Your Template | Supabase Variable | Description |
|---------------|------------------|-------------|
| `{{confirmationUrl}}` | `{{ .ConfirmationURL }}` | Full verification link |
| `{{appUrl}}` | `{{ .SiteURL }}` | Your app URL |
| `{{year}}` | Hardcode or use JS | Current year (not available) |
| `{{userName}}` | `{{ .Data.full_name }}` | User metadata |
| `{{resetUrl}}` | `{{ .ConfirmationURL }}` | Password reset link |
| `{{loginUrl}}` | `{{ .ConfirmationURL }}` | Magic link URL |
| `{{expiryHours}}` | Hardcode `1` | Expiry time |
| `{{expiryMinutes}}` | Hardcode `60` | Expiry time |

#### D. Template Adaptation Example

**Original SendGrid Template:**
```html
<a href="{{confirmationUrl}}" class="email-button">
  Verify Email Address
</a>
<p>This link will expire in 24 hours.</p>
```

**Adapted for Supabase:**
```html
<a href="{{ .ConfirmationURL }}" class="email-button">
  Verify Email Address
</a>
<p>This link will expire in 24 hours.</p>
```

**With User Name (using metadata):**
```html
<h2 class="greeting">Hi {{ .Data.full_name }},</h2>
<p>Thanks for signing up for Snappd!</p>
<a href="{{ .ConfirmationURL }}" class="email-button">
  Verify Email Address
</a>
```

### Step 3: Complete Template Mapping

Map all your custom templates to Supabase templates:

#### 1. Confirm Signup
- **Supabase Template**: Confirm signup
- **Your Template**: `email-templates/email-verification.html`
- **Variables to Replace**:
  ```
  {{confirmationUrl}} → {{ .ConfirmationURL }}
  {{appUrl}} → {{ .SiteURL }}
  ```

#### 2. Magic Link
- **Supabase Template**: Magic Link
- **Your Template**: `email-templates/magic-link.html`
- **Variables to Replace**:
  ```
  {{loginUrl}} → {{ .ConfirmationURL }}
  {{appUrl}} → {{ .SiteURL }}
  {{expiryMinutes}} → Hardcode "60"
  ```

#### 3. Reset Password
- **Supabase Template**: Reset Password
- **Your Template**: `email-templates/password-reset.html`
- **Variables to Replace**:
  ```
  {{resetUrl}} → {{ .ConfirmationURL }}
  {{appUrl}} → {{ .SiteURL }}
  {{expiryHours}} → Hardcode "1"
  ```

#### 4. Welcome Email (Custom Implementation)
- **Not built into Supabase Auth**
- Use `SendGridEmailService.sendWelcomeEmail()` from your code
- Send after email verification or login
- See [Implementation Guide](#sending-custom-emails) below

#### 5. Screenshot Shared (Custom Implementation)
- **Not built into Supabase Auth**
- Use `SendGridEmailService.sendScreenshotShared()` from your code
- See [Implementation Guide](#sending-custom-emails) below

### Step 4: Test Templates

1. **Test Email Verification**:
   ```bash
   # Signup via your app
   npm run dev
   # Navigate to http://localhost:3000/signup
   # Create account with real email
   # Check inbox for styled email
   ```

2. **Test Password Reset**:
   ```bash
   # Navigate to http://localhost:3000/reset-password
   # Enter email
   # Check inbox for styled reset email
   ```

3. **Test Magic Link**:
   ```bash
   # Navigate to http://localhost:3000/login
   # Request magic link
   # Check inbox for styled login email
   ```

### Step 5: Using Template Variables

Add personalization using Supabase's available variables:

#### Available Variables

```html
<!-- User's email -->
<p>Email sent to: {{ .Email }}</p>

<!-- Site URL -->
<p>Visit <a href="{{ .SiteURL }}">{{ .SiteURL }}</a></p>

<!-- Confirmation URL (multi-purpose) -->
<a href="{{ .ConfirmationURL }}">Click here</a>

<!-- User metadata (if provided during signup) -->
<p>Welcome, {{ .Data.full_name }}!</p>
<p>Account type: {{ .Data.account_type }}</p>

<!-- Token (6-digit OTP) -->
<p>Your code: {{ .Token }}</p>

<!-- Token Hash (for custom links) -->
<a href="{{ .SiteURL }}/verify?token={{ .TokenHash }}&type=signup">
  Verify Account
</a>

<!-- Redirect URL (if provided) -->
{{ if .RedirectTo }}
<p>After verification, you'll be redirected to: {{ .RedirectTo }}</p>
{{ end }}
```

#### Advanced: Conditional Content

Use Go template logic for dynamic content:

```html
<!-- Show different content based on metadata -->
{{ if eq .Data.plan "pro" }}
  <p>Welcome to Snappd Pro! You have access to premium features.</p>
{{ else if eq .Data.plan "team" }}
  <p>Welcome to Snappd Team! Collaborate with your team.</p>
{{ else }}
  <p>Welcome to Snappd! Start with our free plan.</p>
{{ end }}

<!-- Only show redirect info if provided -->
{{ if .RedirectTo }}
  <p>After verification, you'll return to: {{ .RedirectTo }}</p>
{{ end }}

<!-- Different greeting based on name availability -->
{{ if .Data.full_name }}
  <h2>Hi {{ .Data.full_name }},</h2>
{{ else }}
  <h2>Hi there,</h2>
{{ end }}
```

---

## Option B: SendGrid Auth Hook (Advanced)

For complete control over email sending, use Supabase's Send Email Auth Hook.

### When to Use

Use the Auth Hook if you need:
- SendGrid Dynamic Templates (not inline HTML)
- React or other templating engines
- Multiple email providers (fallback)
- Email queueing
- Complex personalization logic
- S/MIME signatures
- Custom headers or attachments

### Implementation

#### Step 1: Create Edge Function

Create `supabase/functions/send-email/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import sgMail from 'npm:@sendgrid/mail@7.7.0'

// Initialize SendGrid
sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY') || '')

interface EmailPayload {
  user: {
    id: string
    email: string
    user_metadata?: Record<string, any>
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: 'signup' | 'magiclink' | 'recovery' | 'email_change' | 'invite'
  }
}

serve(async (req) => {
  const payload: EmailPayload = await req.json()

  const { user, email_data } = payload
  const { email_action_type, token_hash, redirect_to } = email_data

  // Map action types to SendGrid template IDs
  const templateMap = {
    'signup': Deno.env.get('SENDGRID_TEMPLATE_EMAIL_VERIFICATION'),
    'magiclink': Deno.env.get('SENDGRID_TEMPLATE_MAGIC_LINK'),
    'recovery': Deno.env.get('SENDGRID_TEMPLATE_PASSWORD_RESET'),
    'email_change': Deno.env.get('SENDGRID_TEMPLATE_EMAIL_CHANGE'),
    'invite': Deno.env.get('SENDGRID_TEMPLATE_INVITE'),
  }

  const templateId = templateMap[email_action_type]

  if (!templateId) {
    return new Response(
      JSON.stringify({ error: 'No template found for action type' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Construct confirmation URL
  const confirmationUrl = `${Deno.env.get('SITE_URL')}/auth/confirm?token_hash=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

  try {
    await sgMail.send({
      to: user.email,
      from: {
        email: Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@snappd.app',
        name: Deno.env.get('SENDGRID_FROM_NAME') || 'Snappd',
      },
      templateId,
      dynamicTemplateData: {
        confirmationUrl,
        userName: user.user_metadata?.full_name || '',
        appUrl: Deno.env.get('SITE_URL'),
        year: new Date().getFullYear().toString(),
      },
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('SendGrid error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to send email' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

#### Step 2: Deploy Edge Function

```bash
# Deploy to Supabase
supabase functions deploy send-email --no-verify-jwt

# Set secrets
supabase secrets set SENDGRID_API_KEY=your-key
supabase secrets set SENDGRID_FROM_EMAIL=noreply@snappd.app
supabase secrets set SENDGRID_FROM_NAME=Snappd
supabase secrets set SITE_URL=https://snappd.app
supabase secrets set SENDGRID_TEMPLATE_EMAIL_VERIFICATION=d-xxx
supabase secrets set SENDGRID_TEMPLATE_MAGIC_LINK=d-xxx
supabase secrets set SENDGRID_TEMPLATE_PASSWORD_RESET=d-xxx
```

#### Step 3: Configure Auth Hook

1. Go to Supabase Dashboard → **Authentication** → **Hooks**
2. Enable **Send Email Hook**
3. Set Edge Function: `send-email`
4. Save

Now all auth emails will be sent via your Edge Function using SendGrid Dynamic Templates!

---

## Sending Custom Emails

For emails not part of Supabase Auth (Welcome, Screenshot Shared), use the `SendGridEmailService`:

### Welcome Email (After Email Verification)

```typescript
// In your email verification callback handler
import { SendGridEmailService } from '@/lib/email/sendgrid'

export async function GET(request: Request) {
  // After successful verification
  const { data: { user }, error } = await supabase.auth.getUser()

  if (user && !error) {
    // Send welcome email
    await SendGridEmailService.sendWelcomeEmail(
      user.email,
      {
        userName: user.user_metadata?.full_name,
        appName: 'Snappd',
        dashboardUrl: process.env.NEXT_PUBLIC_APP_URL + '/dashboard'
      },
      process.env.SENDGRID_TEMPLATE_WELCOME // Use template ID
    )
  }
}
```

### Screenshot Shared Notification

```typescript
import { SendGridEmailService } from '@/lib/email/sendgrid'

export async function POST(request: Request) {
  const { recipientEmail, screenshotUrl, sharedBy, message } = await request.json()

  await SendGridEmailService.sendScreenshotShared(
    recipientEmail,
    {
      screenshotUrl,
      sharedBy,
      senderInitial: sharedBy[0].toUpperCase(),
      message
    },
    process.env.SENDGRID_TEMPLATE_SCREENSHOT_SHARED
  )
}
```

---

## Comparison: SMTP vs Auth Hook

| Feature | SMTP (Option A) | Auth Hook (Option B) |
|---------|----------------|---------------------|
| **Setup Complexity** | ⭐ Simple | ⭐⭐⭐ Advanced |
| **Supabase Template Editing** | ✅ Via Dashboard | ❌ In code only |
| **SendGrid Dynamic Templates** | ❌ No | ✅ Yes |
| **Custom Logic** | ❌ Limited | ✅ Full control |
| **Maintenance** | ⭐ Low | ⭐⭐ Medium |
| **Recommended For** | Most users | Advanced use cases |

---

## Best Practices

### 1. Keep It Simple
- Start with Option A (SMTP with custom Supabase templates)
- Only use Auth Hook if you need advanced features

### 2. Test Thoroughly
```bash
# Test all email flows
- [ ] Signup verification
- [ ] Password reset
- [ ] Magic link
- [ ] Welcome email (custom)
- [ ] Screenshot shared (custom)
```

### 3. Monitor Deliverability
- Check SendGrid Dashboard → Activity
- Monitor bounce rates
- Track open rates
- Review spam reports

### 4. Use Metadata for Personalization
```typescript
// During signup
await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      full_name: 'John Doe',
      plan: 'pro',
      account_type: 'business'
    }
  }
})
```

Then in email templates:
```html
<h2>Hi {{ .Data.full_name }},</h2>
<p>Welcome to Snappd {{ .Data.plan }}!</p>
```

### 5. Handle Year Dynamically
Since `{{year}}` isn't available in Supabase templates, use JavaScript:

```html
<p style="margin-top: 20px; font-size: 12px;">
  © <span id="year"></span> Snappd. All rights reserved.
</p>
<script>
  document.getElementById('year').textContent = new Date().getFullYear();
</script>
```

Or hardcode and update annually:
```html
<p>© 2025 Snappd. All rights reserved.</p>
```

---

## Troubleshooting

### Template Variables Not Rendering

**Issue**: `{{ .ConfirmationURL }}` shows as literal text

**Solution**:
1. Ensure you're editing the **HTML** template (not subject)
2. Variables are case-sensitive: `{{ .ConfirmationURL }}` not `{{ .confirmationurl }}`
3. Save changes in Supabase Dashboard

### SendGrid Templates Not Used

**Issue**: Emails use default Supabase templates

**Solution**:
- You cannot use SendGrid Dynamic Templates with Option A (SMTP)
- SendGrid Dynamic Templates only work with Option B (Auth Hook)
- With SMTP, you must paste HTML directly into Supabase Dashboard

### Emails Not Sending

**Issue**: Users not receiving emails

**Solution**:
1. Verify SMTP settings in Supabase Dashboard
2. Check SendGrid Dashboard → Activity for errors
3. Verify sender email is authenticated
4. Check spam folder
5. Review Supabase Dashboard → Logs for errors

---

## Summary

### Recommended Approach (Option A)

1. ✅ Configure SendGrid SMTP in Supabase Dashboard
2. ✅ Copy HTML from `email-templates/*.html`
3. ✅ Replace SendGrid variables with Supabase variables
4. ✅ Paste into Supabase Dashboard → Email Templates
5. ✅ Use `SendGridEmailService` for custom emails

### Result

- 🎨 Professional branded emails
- 📧 Good deliverability via SendGrid
- 🔧 Easy to maintain
- ⚡ No additional infrastructure

---

## Resources

- [Supabase Email Templates Docs](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase SMTP Setup](https://supabase.com/docs/guides/auth/auth-smtp)
- [SendGrid Setup Guide](./SENDGRID_SETUP.md)
- [Template Deployment Guide](./TEMPLATE_DEPLOYMENT.md)
- [Email Templates](../email-templates/README.md)

# Testing Payment Failure Flow (T049)

## Prerequisites

1. **Stripe CLI installed**:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```

3. **Configure webhook forwarding**:
   ```bash
   stripe listen --forward-to http://localhost:3000/api/v1/billing/webhook
   ```

4. **Copy webhook signing secret** from CLI output:
   ```bash
   # Add to .env.local:
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## Test Scenarios

### Scenario 1: First Payment Failure (Attempt #1)

**Goal:** Verify initial payment failure triggers proper email and database updates.

**Steps:**
1. Create a test subscription with declining card:
   ```bash
   # Use Stripe test card that always declines
   # Card number: 4000 0000 0000 0002
   ```

2. Trigger payment failure webhook:
   ```bash
   stripe trigger invoice.payment_failed
   ```

3. **Expected Behavior:**
   - ✅ Subscription status updated to `past_due`
   - ✅ Dunning attempt #1 created in database:
     - `attempt_number`: 1
     - `payment_result`: 'failed'
     - `next_retry_date`: Now + 3 days
     - `notification_sent`: true
   - ✅ Subscription event logged (event_type: 'payment_failed')
   - ✅ Email sent with gentle reminder tone (yellow/orange)
   - ✅ Grace period starts: 14 days remaining

4. **Verify in database:**
   ```sql
   SELECT * FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx';
   -- status should be 'past_due'

   SELECT * FROM dunning_attempts WHERE subscription_id = (
     SELECT id FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx'
   );
   -- Should have 1 row with attempt_number = 1

   SELECT * FROM subscription_events
   WHERE event_type = 'payment_failed'
   ORDER BY created_at DESC LIMIT 1;
   -- Should show payment_failed event
   ```

5. **Verify email:**
   - Check SendGrid Activity dashboard
   - Email subject: "Payment Failed - [Plan] Subscription"
   - Body includes: amount due, failure reason, 14 days grace period

---

### Scenario 2: Second Payment Failure (Attempt #2, Day 3)

**Goal:** Verify escalating urgency in email and dunning tracking.

**Steps:**
1. Simulate 3 days passing (manually insert past dunning attempt):
   ```sql
   UPDATE dunning_attempts
   SET attempt_date = NOW() - INTERVAL '3 days'
   WHERE subscription_id = (SELECT id FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx')
     AND attempt_number = 1;
   ```

2. Trigger second payment failure:
   ```bash
   stripe trigger invoice.payment_failed
   ```

3. **Expected Behavior:**
   - ✅ Subscription remains `past_due`
   - ✅ Dunning attempt #2 created:
     - `attempt_number`: 2
     - `next_retry_date`: First attempt date + 7 days
   - ✅ Email sent with urgent tone (red theme)
   - ✅ Grace period countdown: 11 days remaining

---

### Scenario 3: Third Payment Failure (Attempt #3, Day 7)

**Goal:** Verify final warning email.

**Steps:**
1. Simulate 7 days passing:
   ```sql
   UPDATE dunning_attempts
   SET attempt_date = NOW() - INTERVAL '7 days'
   WHERE subscription_id = (SELECT id FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx')
     AND attempt_number = 1;
   ```

2. Trigger third payment failure:
   ```bash
   stripe trigger invoice.payment_failed
   ```

3. **Expected Behavior:**
   - ✅ Dunning attempt #3 created:
     - `attempt_number`: 3
     - `next_retry_date`: NULL (no more automatic retries)
   - ✅ Email sent with critical tone (dark red theme)
   - ✅ Grace period countdown: 7 days remaining

---

### Scenario 4: Grace Period Quota Access

**Goal:** Verify premium features remain active during grace period.

**Steps:**
1. Ensure subscription is `past_due` with active grace period
2. Make API call to check quota:
   ```bash
   curl http://localhost:3000/api/v1/auth/user/usage \
     -H "Authorization: Bearer $ACCESS_TOKEN"
   ```

3. **Expected Behavior:**
   - ✅ User has premium access (no quota limits)
   - ✅ Response indicates `plan: 'pro'` or `plan: 'team'`
   - ✅ Uploads allowed despite `past_due` status

4. **Verify quota logic:**
   ```typescript
   // In getUserPlan(), this should return:
   {
     plan: 'pro',  // or 'team'
     subscriptionStatus: 'past_due',
     isPastDue: true
   }
   ```

---

### Scenario 5: Payment Recovery (Success After Failure)

**Goal:** Verify subscription restored to active when payment succeeds.

**Steps:**
1. Update payment method in Stripe (or trigger webhook):
   ```bash
   stripe trigger invoice.payment_succeeded
   ```

2. **Expected Behavior:**
   - ✅ Subscription status updated from `past_due` to `active`
   - ✅ Dunning attempts marked as successful:
     ```sql
     UPDATE dunning_attempts SET payment_result = 'success'
     WHERE subscription_id = X AND payment_result = 'failed';
     ```
   - ✅ Subscription event logged (event_type: 'payment_recovered')
   - ✅ Invoice email sent (normal paid invoice)

3. **Verify recovery:**
   ```sql
   SELECT * FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx';
   -- status should be 'active'

   SELECT * FROM dunning_attempts WHERE subscription_id = (
     SELECT id FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx'
   );
   -- payment_result should be 'success' for all rows

   SELECT * FROM subscription_events
   WHERE event_type = 'payment_recovered'
   ORDER BY created_at DESC LIMIT 1;
   -- Should show recovery event
   ```

---

### Scenario 6: Grace Period Expiration (Day 14)

**Goal:** Verify suspension after grace period expires.

**Steps:**
1. Simulate 14 days passing:
   ```sql
   UPDATE dunning_attempts
   SET attempt_date = NOW() - INTERVAL '14 days'
   WHERE subscription_id = (SELECT id FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx')
     AND attempt_number = 1;
   ```

2. Trigger subscription update event:
   ```bash
   stripe trigger customer.subscription.updated
   ```

3. **Expected Behavior:**
   - ✅ Subscription status updated from `past_due` to `suspended`
   - ✅ Subscription event logged (event_type: 'suspended')
   - ✅ Premium access immediately revoked
   - ✅ User falls back to free tier quota limits

4. **Verify suspension:**
   ```sql
   SELECT * FROM subscriptions WHERE stripe_subscription_id = 'sub_xxx';
   -- status should be 'suspended'

   SELECT * FROM subscription_events
   WHERE event_type = 'suspended'
   ORDER BY created_at DESC LIMIT 1;
   -- Should show suspension with grace_period_expired reason
   ```

5. **Verify quota enforcement:**
   ```bash
   curl http://localhost:3000/api/v1/auth/user/usage \
     -H "Authorization: Bearer $ACCESS_TOKEN"
   ```
   - ✅ Response should show `plan: 'free'`
   - ✅ Monthly upload limit: 10

---

## Edge Cases to Test

### Edge Case 1: Idempotency
**Test:** Send same `invoice.payment_failed` webhook twice

**Expected:**
- ✅ Second webhook returns 200 OK with "already processed" message
- ✅ No duplicate dunning attempts created
- ✅ No duplicate emails sent
- ✅ Idempotency tracked in `stripe_events` table

### Edge Case 2: Missing Stripe Data
**Test:** Trigger webhook with missing customer ID or subscription ID

**Expected:**
- ✅ Handler throws error
- ✅ Returns 500 to trigger Stripe retry
- ✅ Logs error with request ID

### Edge Case 3: Concurrent Payment Failures
**Test:** Trigger multiple failures in rapid succession

**Expected:**
- ✅ `UNIQUE(subscription_id, attempt_number)` constraint prevents duplicates
- ✅ Subsequent failures increment attempt_number correctly
- ✅ No race conditions in dunning attempt creation

### Edge Case 4: Recovery After Suspension
**Test:** Successful payment after suspension (>14 days)

**Expected:**
- ✅ Subscription restored from `suspended` to `active`
- ✅ Dunning attempts cleared
- ✅ Premium access restored immediately

---

## Monitoring & Debugging

### Check Logs
```bash
# View webhook processing logs
grep "invoice.payment_failed" logs/app.log

# View email delivery logs
grep "Payment failure email sent" logs/app.log
```

### SendGrid Activity
1. Login to SendGrid Dashboard
2. Navigate to: Activity → Search by recipient email
3. Verify email delivery, opens, clicks

### Stripe Dashboard
1. Navigate to: Developers → Webhooks → Test webhooks
2. Check event delivery status
3. View webhook response codes

### Database Queries
```sql
-- View all dunning attempts for a user
SELECT
  da.*,
  s.stripe_subscription_id,
  s.status as subscription_status
FROM dunning_attempts da
JOIN subscriptions s ON da.subscription_id = s.id
WHERE s.user_id = 'user_id_here'
ORDER BY da.attempt_number;

-- View subscription event timeline
SELECT
  event_type,
  previous_status,
  new_status,
  created_at,
  metadata
FROM subscription_events
WHERE user_id = 'user_id_here'
ORDER BY created_at DESC;

-- Check grace period status
SELECT
  s.stripe_subscription_id,
  s.status,
  da.attempt_date as grace_period_start,
  da.attempt_date + INTERVAL '14 days' as grace_period_end,
  NOW() < (da.attempt_date + INTERVAL '14 days') as in_grace_period
FROM subscriptions s
LEFT JOIN dunning_attempts da ON da.subscription_id = s.id AND da.attempt_number = 1
WHERE s.status = 'past_due';
```

---

## Success Criteria Checklist

- [ ] ✅ Payment failure triggers immediate email notification
- [ ] ✅ Subscription status updates to `past_due`
- [ ] ✅ Dunning attempt records created with correct attempt number
- [ ] ✅ Grace period maintains premium access for 14 days
- [ ] ✅ Email urgency escalates with each retry (gentle → urgent → critical)
- [ ] ✅ Payment recovery restores `active` status within 5 minutes
- [ ] ✅ Suspension occurs after 14-day grace period
- [ ] ✅ All state changes logged in `subscription_events` table
- [ ] ✅ Idempotency prevents duplicate processing
- [ ] ✅ Error handling returns 500 for Stripe retry

---

## Next Steps (Future Enhancements)

1. **Suspension Email Template** (TODO in code):
   - Create email template for suspension notification
   - Send when subscription transitions to `suspended`
   - Include "Update Payment Method" CTA

2. **Automated Reminders**:
   - Send reminder emails on Day 5 and Day 10
   - Increase urgency as grace period expires

3. **Payment Recovery Confirmation Email**:
   - Send success email when payment recovers
   - Thank user for updating payment method
   - Confirm restoration of premium features

4. **Stripe Smart Retries Dashboard Configuration**:
   - Configure in Stripe Dashboard → Settings → Billing
   - Set retry schedule: Day 3, Day 7, Day 14
   - Disable Stripe's default emails (use custom templates)

5. **Analytics Dashboard**:
   - Track payment recovery rate (target: 30-40%)
   - Monitor grace period effectiveness
   - Identify common failure reasons
   - Alert on high failure rates

---

## Configuration Required

### Stripe Dashboard (T048)
**Path:** Settings → Billing → Subscriptions and emails

**Settings:**
- ✅ Enable Smart Retries
- ✅ Retry schedule: Day 3, Day 7, Day 14
- ✅ Disable Stripe default emails (we send custom emails)

**To configure:**
1. Login to Stripe Dashboard
2. Navigate to Settings → Billing
3. Scroll to "Smart Retries"
4. Enable and set schedule
5. Save changes

---

## Troubleshooting

### Issue: Email not sending
**Check:**
1. SendGrid API key configured in `.env.local`
2. Sender email verified in SendGrid
3. Check SendGrid Activity for bounces/blocks

### Issue: Dunning attempt not created
**Check:**
1. Database migration applied: `dunning_attempts` table exists
2. Subscription record exists for Stripe subscription ID
3. Check logs for database errors

### Issue: Grace period not working
**Check:**
1. First dunning attempt exists with correct `attempt_date`
2. Quota logic queries `dunning_attempts` table
3. Calculation: `NOW() < (attempt_date + 14 days)`

### Issue: Suspension not triggering
**Check:**
1. `handleSubscriptionUpdated` being called on updates
2. Grace period calculation correctly identifies expiration
3. Database permissions for updating `subscriptions` table

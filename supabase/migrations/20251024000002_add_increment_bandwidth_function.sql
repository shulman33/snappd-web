-- Function to atomically increment bandwidth usage
-- Called when public screenshots are viewed
CREATE OR REPLACE FUNCTION increment_bandwidth(
  p_user_id UUID,
  p_month TEXT,
  p_bytes BIGINT
)
RETURNS void AS $$
BEGIN
  -- Insert or update monthly_usage record
  INSERT INTO monthly_usage (user_id, month, bandwidth_bytes)
  VALUES (p_user_id, p_month, p_bytes)
  ON CONFLICT (user_id, month)
  DO UPDATE SET bandwidth_bytes = monthly_usage.bandwidth_bytes + p_bytes;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_bandwidth(UUID, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_bandwidth(UUID, TEXT, BIGINT) TO service_role;


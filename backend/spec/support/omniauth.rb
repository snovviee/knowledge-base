# OmniAuth test mode for every example, so no test reaches Google or GitHub
# (requirements.md section 7). An example that needs a provider response sets
# OmniAuth.config.mock_auth[:google_oauth2] itself.
#
RSpec.configure do |config|
  config.before do
    OmniAuth.config.test_mode = true
  end

  config.after do
    OmniAuth.config.mock_auth[:google_oauth2] = nil
    OmniAuth.config.test_mode = true
  end
end

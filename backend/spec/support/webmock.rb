# No test reaches another host (features/27_local_tests, spec question 4). WebMock refuses
# an HTTP request to any host but this machine before it is sent, with
# WebMock::NetConnectNotAllowedError ("Real HTTP connections are disabled. Unregistered
# request: ..."). That error is an Exception, not a StandardError, so code that rescues
# StandardError (the app's, Faraday's, OmniAuth's) does not swallow it, and the test fails.
# This machine (localhost, 127.0.0.1, ::1) is let through. A raw socket is not covered.
require "webmock/rspec"

WebMock.disable_net_connect!(allow_localhost: true)

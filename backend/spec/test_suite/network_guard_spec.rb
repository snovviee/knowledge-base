require "rails_helper"
require "net/http"

# features/27_local_tests, spec question 4. No backend test reaches another host: a request
# to one is refused before it is sent, and the test that made it fails. A request to this
# machine goes out. 192.0.2.1 is TEST-NET-1, an address kept for documentation, so even a
# request that got out would reach no real host.
RSpec.describe "The backend tests' network" do
  it "AC-27 a backend test that requests another host fails before anything is sent, and one to this machine goes out" do
    expect {
      Net::HTTP.start("192.0.2.1", 80, open_timeout: 2) { |http| http.get("/") }
    }.to raise_error(/\AReal HTTP connections are disabled/)

    # Nothing listens on port 9 here, so this machine itself refuses the request.
    expect { Net::HTTP.get(URI("http://localhost:9/")) }.to raise_error(Errno::ECONNREFUSED)
  end
end

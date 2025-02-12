import { Logger } from "./utils/logger";
import { DockerService } from "./services/docker.service";
import { DNSService } from "./services/dns.service";
import Table from "cli-table3";

export class Application {
  private logger = Logger.getInstance();
  private dockerService = DockerService.getInstance();
  private dnsService = DNSService.getInstance();

  private displayConfigSummary(): void {
    const table = new Table({
      head: ["Configuration", "Value"],
      style: {
        head: ["cyan", "bold"],
        border: ["grey"],
      },
      chars: {
        top: "═",
        "top-mid": "╤",
        "top-left": "╔",
        "top-right": "╗",
        bottom: "═",
        "bottom-mid": "╧",
        "bottom-left": "╚",
        "bottom-right": "╝",
        left: "║",
        "left-mid": "╟",
        right: "║",
        "right-mid": "╢",
      },
    });

    table.push(
      ["Environment", process.env.NODE_ENV || "development"],
      ["Cloudflare Zone", process.env.CLOUDFLARE_ZONE_ID || "not set"],
      [
        "Cloudflare Token",
        process.env.CLOUDFLARE_TOKEN ? "********" : "not set",
      ],
      ["Docker Socket", process.env.DOCKER_SOCKET || "/var/run/docker.sock"],
      ["DNS Label Prefix", "dns.cloudflare."],
      [
        "Processing Interval",
        `${process.env.TASK_PROCESSING_INTERVAL || "5000"}ms`,
      ],
      ["Log Level", process.env.LOG_LEVEL || "info"]
    );

    console.log("\n📋 Cloudflare DNS Swarm Manager Configuration:");
    console.log(table.toString());
    console.log(); // Empty line after table
  }

  public async start(): Promise<void> {
    try {
      this.logger.info("Starting Cloudflare DNS Swarm Manager", {
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "production",
      });

      this.displayConfigSummary();

      await this.dockerService.startMonitoring();

      this.dockerService.on(
        "dns-update",
        (data: { event: string; service: string; labels: any }) => {
          this.dnsService
            .handleServiceUpdate(data.service, data.labels)
            .catch((error: Error) => {
              this.logger.error("Failed to handle DNS update", { error, data });
            });
        }
      );

      this.logger.info("Application started successfully");

      process.on("SIGTERM", () => this.shutdown());
      process.on("SIGINT", () => this.shutdown());
    } catch (error) {
      this.logger.error("Failed to start application", { error });
      throw error;
    }
  }

  private async shutdown(): Promise<void> {
    this.logger.info("Shutting down application...");
    process.exit(0);
  }
}

if (require.main === module) {
  const app = new Application();
  app.start().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

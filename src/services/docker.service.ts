import Docker from "dockerode";
import { EventEmitter } from "events";
import { Logger } from "../utils/logger";
import { config } from "../config/config";

export class DockerService extends EventEmitter {
  private docker: Docker;
  private logger = Logger.getInstance();
  private static instance: DockerService;

  private constructor() {
    super();
    this.docker = new Docker({ socketPath: config.docker.socketPath });
  }

  public static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  public async startMonitoring(): Promise<void> {
    try {
      const eventStream = await this.docker.getEvents({
        filters: {
          type: ["service"],
          event: ["create", "update", "remove"],
        },
      });

      eventStream.on("data", (buffer) => {
        const event = JSON.parse(buffer.toString());
        this.handleServiceEvent(event);
      });

      this.logger.info("Docker event monitoring started");
    } catch (error) {
      this.logger.error("Failed to start Docker event monitoring", { error });
      throw error;
    }
  }

  private async handleServiceEvent(event: any): Promise<void> {
    try {
      const serviceId = event.actor.ID;
      const service = await this.docker.getService(serviceId).inspect();

      const labels = service.Spec.Labels || {};
      const dnsLabels = this.extractDNSLabels(labels);

      if (dnsLabels) {
        this.emit("dns-update", {
          event: event.Action,
          service: service.Spec.Name,
          labels: dnsLabels,
        });
      }
    } catch (error) {
      this.logger.error("Error handling service event", { error });
    }
  }

  private extractDNSLabels(labels: { [key: string]: string }): any {
    const dnsPrefix = "dns.cloudflare.";
    const dnsLabels: { [key: string]: string } = {};
    let hasDNSLabels = false;

    Object.entries(labels).forEach(([key, value]) => {
      if (key.startsWith(dnsPrefix)) {
        hasDNSLabels = true;
        const labelName = key.replace(dnsPrefix, "");
        dnsLabels[labelName] = value;
      }
    });

    return hasDNSLabels ? dnsLabels : null;
  }
}

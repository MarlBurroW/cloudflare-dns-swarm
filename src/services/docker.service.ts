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
      // Scanner les services existants au démarrage
      await this.scanExistingServices();

      // Écouter les événements Swarm et conteneurs
      const eventStream = await this.docker.getEvents({
        filters: {
          type: ["service", "container"],
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

  private async scanExistingServices(): Promise<void> {
    try {
      this.logger.debug("Scanning existing services...");

      // Essayer d'abord en mode Swarm
      try {
        const services = await this.docker.listServices({
          filters: {
            label: ["dns.cloudflare.hostname"],
          },
        });

        for (const service of services) {
          if (!service.Spec) continue;
          const labels = service.Spec.Labels || {};
          const dnsLabels = this.extractDNSLabels(labels);
          if (dnsLabels) {
            this.emit("dns-update", {
              event: "update",
              service: service.Spec.Name,
              labels: dnsLabels,
            });
          }
        }

        this.logger.debug(
          `Completed scanning ${services.length} Swarm services`
        );
      } catch (error) {
        this.logger.debug("Not in Swarm mode or no services found", { error });
      }

      // Puis scanner les conteneurs en mode standard
      const containers = await this.docker.listContainers();
      this.logger.debug(`Found ${containers.length} containers`, {
        containerNames: containers.map((c) => c.Names[0]),
      });

      let containerCount = 0;

      for (const container of containers) {
        this.logger.debug(`Checking container ${container.Names[0]}`, {
          image: container.Image,
          state: container.State,
          status: container.Status,
        });

        const labels = container.Labels || {};
        const dnsLabels = this.extractDNSLabels(labels);

        if (dnsLabels) {
          containerCount++;
          this.logger.debug(
            `DNS labels found on container ${container.Names[0]}`,
            { dnsLabels }
          );

          this.emit("dns-update", {
            event: "update",
            service: container.Names[0].replace(/^\//, ""),
            labels: dnsLabels,
          });
        }
      }

      this.logger.debug(`Completed scanning ${containerCount} containers`);
    } catch (error) {
      this.logger.error("Failed to scan services/containers", { error });
      throw error;
    }
  }

  private async handleServiceEvent(event: any): Promise<void> {
    try {
      this.logger.debug("Received Docker event", {
        type: event.Type,
        action: event.Action,
        id: event.actor.ID,
      });

      let labels, serviceName;

      // Gérer les événements Swarm
      if (event.Type === "service") {
        const service = await this.docker.getService(event.actor.ID).inspect();
        labels = service.Spec?.Labels || {};
        serviceName = service.Spec?.Name;
        this.logger.debug("Service event details", { serviceName, labels });
      }
      // Gérer les événements de conteneurs
      else if (event.Type === "container") {
        const container = await this.docker
          .getContainer(event.actor.ID)
          .inspect();
        labels = container.Config?.Labels || {};
        serviceName = container.Name.replace(/^\//, "");
        this.logger.debug("Container event details", {
          serviceName,
          labels,
          state: container.State,
          status: container.State?.Status,
        });
      }

      if (labels && serviceName) {
        const dnsLabels = this.extractDNSLabels(labels);
        if (dnsLabels) {
          this.emit("dns-update", {
            event: event.Action,
            service: serviceName,
            labels: dnsLabels,
          });
        }
      }
    } catch (error) {
      this.logger.error("Error handling event", { error });
    }
  }

  private extractDNSLabels(labels: { [key: string]: string }): any {
    const dnsPrefix = "dns.cloudflare.";
    const dnsLabels: { [key: string]: string } = {};
    let hasDNSLabels = false;

    Object.entries(labels).forEach(([key, value]) => {
      if (key.startsWith(dnsPrefix)) {
        hasDNSLabels = true;
        dnsLabels[key] = value;
        this.logger.debug(`Found DNS label: ${key} = ${value}`);
      }
    });

    return hasDNSLabels ? dnsLabels : null;
  }
}

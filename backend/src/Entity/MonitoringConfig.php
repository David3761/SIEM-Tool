<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\MonitoringConfigRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MonitoringConfigRepository::class)]
#[ORM\Table(name: 'monitoring_config')]
class MonitoringConfig
{
    #[ORM\Id]
    #[ORM\Column(type: 'integer')]
    private int $id = 1;

    #[ORM\Column(type: 'json')]
    private array $monitoredInterfaces = [];

    #[ORM\Column(type: 'json')]
    private array $monitoredSubnets = [];

    #[ORM\Column(type: 'json')]
    private array $excludedIps = [];

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $updatedAt = null;

    public function getId(): int { return $this->id; }
    public function getMonitoredInterfaces(): array { return $this->monitoredInterfaces; }
    public function setMonitoredInterfaces(array $interfaces): static { $this->monitoredInterfaces = $interfaces; return $this; }
    public function getMonitoredSubnets(): array { return $this->monitoredSubnets; }
    public function setMonitoredSubnets(array $subnets): static { $this->monitoredSubnets = $subnets; return $this; }
    public function getExcludedIps(): array { return $this->excludedIps; }
    public function setExcludedIps(array $ips): static { $this->excludedIps = $ips; return $this; }
    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }
    public function setUpdatedAt(?\DateTimeImmutable $dt): static { $this->updatedAt = $dt; return $this; }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'monitored_interfaces' => $this->monitoredInterfaces,
            'monitored_subnets' => $this->monitoredSubnets,
            'excluded_ips' => $this->excludedIps,
            'updated_at' => $this->updatedAt?->format(\DateTimeInterface::ATOM),
        ];
    }
}

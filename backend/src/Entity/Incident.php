<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\IncidentRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: IncidentRepository::class)]
#[ORM\Table(name: 'incidents')]
class Incident
{
    public const STATUSES = ['open', 'in_progress', 'resolved'];
    public const SEVERITIES = ['low', 'medium', 'high', 'critical'];
    public const SEVERITY_RANK = ['low' => 0, 'medium' => 1, 'high' => 2, 'critical' => 3];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 255)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: 'string', length: 20)]
    private string $severity;

    #[ORM\Column(type: 'string', length: 20)]
    private string $status;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\Column(type: 'json')]
    private array $alertIds = [];

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $aiRemediation = null;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $timeline = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->status = 'open';
    }

    public function getId(): int { return $this->id; }
    public function getTitle(): string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }
    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $desc): static { $this->description = $desc; return $this; }
    public function getSeverity(): string { return $this->severity; }
    public function setSeverity(string $severity): static { $this->severity = $severity; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }
    public function setUpdatedAt(?\DateTimeImmutable $dt): static { $this->updatedAt = $dt; return $this; }
    public function getAlertIds(): array { return $this->alertIds; }
    public function setAlertIds(array $ids): static { $this->alertIds = $ids; return $this; }
    public function getAiRemediation(): ?array { return $this->aiRemediation; }
    public function setAiRemediation(?array $data): static { $this->aiRemediation = $data; return $this; }
    public function getTimeline(): ?array { return $this->timeline; }
    public function setTimeline(?array $tl): static { $this->timeline = $tl; return $this; }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'severity' => $this->severity,
            'status' => $this->status,
            'created_at' => $this->createdAt->format(\DateTimeInterface::ATOM),
            'updated_at' => $this->updatedAt?->format(\DateTimeInterface::ATOM),
            'alert_ids' => $this->alertIds,
            'ai_remediation' => $this->aiRemediation,
            'timeline' => $this->timeline,
        ];
    }
}

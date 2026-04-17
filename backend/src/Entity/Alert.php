<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\AlertRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: AlertRepository::class)]
#[ORM\Table(name: 'alerts')]
class Alert
{
    public const STATUSES = ['open', 'acknowledged', 'false_positive', 'resolved'];
    public const SEVERITIES = ['low', 'medium', 'high', 'critical'];

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private ?string $id = null;

    #[ORM\Column(type: 'string', length: 100)]
    private string $ruleId;

    #[ORM\Column(type: 'string', length: 255)]
    private string $ruleName;

    #[ORM\Column(type: 'string', length: 20)]
    private string $severity;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $timestamp;

    #[ORM\Column(type: 'string', length: 30)]
    private string $status;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?string $triggeringEventId = null;

    #[ORM\Column(type: 'json')]
    private array $relatedEventIds = [];

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $aiAnalysis = null;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?string $incidentId = null;

    public function __construct()
    {
        $this->timestamp = new \DateTimeImmutable();
        $this->status = 'open';
    }

    public function getId(): string { return $this->id; }
    public function getRuleId(): string { return $this->ruleId; }
    public function setRuleId(string $ruleId): static { $this->ruleId = $ruleId; return $this; }
    public function getRuleName(): string { return $this->ruleName; }
    public function setRuleName(string $ruleName): static { $this->ruleName = $ruleName; return $this; }
    public function getSeverity(): string { return $this->severity; }
    public function setSeverity(string $severity): static { $this->severity = $severity; return $this; }
    public function getTimestamp(): \DateTimeImmutable { return $this->timestamp; }
    public function setTimestamp(\DateTimeImmutable $ts): static { $this->timestamp = $ts; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
    public function getTriggeringEventId(): ?string { return $this->triggeringEventId; }
    public function setTriggeringEventId(?string $id): static { $this->triggeringEventId = $id; return $this; }
    public function getRelatedEventIds(): array { return $this->relatedEventIds; }
    public function setRelatedEventIds(array $ids): static { $this->relatedEventIds = $ids; return $this; }
    public function getAiAnalysis(): ?array { return $this->aiAnalysis; }
    public function setAiAnalysis(?array $analysis): static { $this->aiAnalysis = $analysis; return $this; }
    public function getIncidentId(): ?string { return $this->incidentId; }
    public function setIncidentId(?string $id): static { $this->incidentId = $id; return $this; }

    public function toArray(?NetworkEvent $triggeringEvent = null): array
    {
        return [
            'id' => $this->id,
            'rule_id' => $this->ruleId,
            'rule_name' => $this->ruleName,
            'severity' => $this->severity,
            'timestamp' => $this->timestamp->format(\DateTimeInterface::ATOM),
            'status' => $this->status,
            'triggering_event_id' => $this->triggeringEventId,
            'triggering_event' => $triggeringEvent?->toArray(),
            'related_event_ids' => $this->relatedEventIds,
            'ai_analysis' => $this->aiAnalysis,
            'incident_id' => $this->incidentId,
        ];
    }
}

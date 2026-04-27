<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\RuleRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RuleRepository::class)]
#[ORM\Table(name: 'rules')]
class Rule
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'string')]
    private ?string $id = null;

    #[ORM\Column(type: 'string', length: 255)]
    private string $name;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: 'string', length: 50)]
    private string $ruleType;

    #[ORM\Column(type: 'string', length: 20)]
    private string $severity;

    #[ORM\Column(type: 'json')]
    private array $config = [];

    #[ORM\Column(type: 'boolean')]
    private bool $enabled = true;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?string { return $this->id; }

    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }
    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $desc): static { $this->description = $desc; return $this; }
    public function getRuleType(): string { return $this->ruleType; }
    public function setRuleType(string $type): static { $this->ruleType = $type; return $this; }
    public function getSeverity(): string { return $this->severity; }
    public function setSeverity(string $severity): static { $this->severity = $severity; return $this; }
    public function getConfig(): array { return $this->config; }
    public function setConfig(array $config): static { $this->config = $config; return $this; }
    public function isEnabled(): bool { return $this->enabled; }
    public function setEnabled(bool $enabled): static { $this->enabled = $enabled; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'rule_type' => $this->ruleType,
            'severity' => $this->severity,
            'config' => $this->config,
            'enabled' => $this->enabled,
            'created_at' => $this->createdAt->format(\DateTimeInterface::ATOM),
        ];
    }

}

<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\NetworkEventRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: NetworkEventRepository::class)]
#[ORM\Table(name: 'network_events')]
class NetworkEvent
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private ?string $id = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $timestamp;

    #[ORM\Column(type: 'string', length: 45)]
    private string $srcIp;

    #[ORM\Column(type: 'string', length: 45)]
    private string $dstIp;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $srcPort = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $dstPort = null;

    #[ORM\Column(type: 'string', length: 10)]
    private string $protocol; // TCP/UDP/ICMP/OTHER

    #[ORM\Column(type: 'integer')]
    private int $bytesSent;

    #[ORM\Column(type: 'string', length: 20)]
    private string $direction; // inbound/outbound/internal

    #[ORM\Column(type: 'string', length: 50)]
    private string $interface;

    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    private ?string $flags = null;

    public function __construct()
    {
        $this->timestamp = new \DateTimeImmutable();
    }

    public function getId(): string { return $this->id; }
    public function getTimestamp(): \DateTimeImmutable { return $this->timestamp; }
    public function setTimestamp(\DateTimeImmutable $timestamp): static { $this->timestamp = $timestamp; return $this; }
    public function getSrcIp(): string { return $this->srcIp; }
    public function setSrcIp(string $srcIp): static { $this->srcIp = $srcIp; return $this; }
    public function getDstIp(): string { return $this->dstIp; }
    public function setDstIp(string $dstIp): static { $this->dstIp = $dstIp; return $this; }
    public function getSrcPort(): ?int { return $this->srcPort; }
    public function setSrcPort(?int $srcPort): static { $this->srcPort = $srcPort; return $this; }
    public function getDstPort(): ?int { return $this->dstPort; }
    public function setDstPort(?int $dstPort): static { $this->dstPort = $dstPort; return $this; }
    public function getProtocol(): string { return $this->protocol; }
    public function setProtocol(string $protocol): static { $this->protocol = $protocol; return $this; }
    public function getBytesSent(): int { return $this->bytesSent; }
    public function setBytesSent(int $bytesSent): static { $this->bytesSent = $bytesSent; return $this; }
    public function getDirection(): string { return $this->direction; }
    public function setDirection(string $direction): static { $this->direction = $direction; return $this; }
    public function getInterface(): string { return $this->interface; }
    public function setInterface(string $interface): static { $this->interface = $interface; return $this; }
    public function getFlags(): ?string { return $this->flags; }
    public function setFlags(?string $flags): static { $this->flags = $flags; return $this; }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'timestamp' => $this->timestamp->format(\DateTimeInterface::ATOM),
            'src_ip' => $this->srcIp,
            'dst_ip' => $this->dstIp,
            'src_port' => $this->srcPort,
            'dst_port' => $this->dstPort,
            'protocol' => $this->protocol,
            'bytes_sent' => $this->bytesSent,
            'direction' => $this->direction,
            'interface' => $this->interface,
            'flags' => $this->flags,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\NetworkEvent;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;

class NetworkEventRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, NetworkEvent::class);
    }

    public function createFilteredQueryBuilder(array $filters): QueryBuilder
    {
        $qb = $this->createQueryBuilder('e')
            ->orderBy('e.timestamp', 'DESC');

        if (!empty($filters['src_ip'])) {
            $qb->andWhere('e.srcIp = :srcIp')->setParameter('srcIp', $filters['src_ip']);
        }
        if (!empty($filters['dst_ip'])) {
            $qb->andWhere('e.dstIp = :dstIp')->setParameter('dstIp', $filters['dst_ip']);
        }
        if (!empty($filters['protocol'])) {
            $qb->andWhere('e.protocol = :protocol')->setParameter('protocol', $filters['protocol']);
        }
        if (!empty($filters['port'])) {
            $qb->andWhere('e.srcPort = :port OR e.dstPort = :port')->setParameter('port', (int)$filters['port']);
        }
        if (!empty($filters['direction'])) {
            $qb->andWhere('e.direction = :direction')->setParameter('direction', $filters['direction']);
        }
        if (!empty($filters['from'])) {
            $qb->andWhere('e.timestamp >= :from')->setParameter('from', new \DateTimeImmutable($filters['from']));
        }
        if (!empty($filters['to'])) {
            $qb->andWhere('e.timestamp <= :to')->setParameter('to', new \DateTimeImmutable($filters['to']));
        }

        return $qb;
    }

    public function getStats(\DateTimeImmutable $since): array
    {
        $conn = $this->getEntityManager()->getConnection();

        $topSrcIps = $conn->fetchAllAssociative(
            'SELECT src_ip, COUNT(*) as count FROM network_events WHERE timestamp >= :since GROUP BY src_ip ORDER BY count DESC LIMIT 10',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        $topDstIps = $conn->fetchAllAssociative(
            'SELECT dst_ip, COUNT(*) as count FROM network_events WHERE timestamp >= :since GROUP BY dst_ip ORDER BY count DESC LIMIT 10',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        $topPorts = $conn->fetchAllAssociative(
            'SELECT COALESCE(dst_port, src_port) as port, protocol, COUNT(*) as count FROM network_events WHERE timestamp >= :since AND (dst_port IS NOT NULL OR src_port IS NOT NULL) GROUP BY port, protocol ORDER BY count DESC LIMIT 10',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        $protocolBreakdown = $conn->fetchAllAssociative(
            'SELECT protocol, COUNT(*) as count FROM network_events WHERE timestamp >= :since GROUP BY protocol',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        $totals = $conn->fetchAssociative(
            'SELECT COUNT(*) as total_events, COALESCE(SUM(bytes_sent), 0) as total_bytes FROM network_events WHERE timestamp >= :since',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        $directionCounts = $conn->fetchAllAssociative(
            'SELECT direction, COUNT(*) as count FROM network_events WHERE timestamp >= :since GROUP BY direction',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        // Events per minute
        $intervalMinutes = max(1, (int) round((new \DateTimeImmutable())->getTimestamp() - $since->getTimestamp()) / 60);
        $eventsPerMinute = round((int)($totals['total_events'] ?? 0) / $intervalMinutes, 2);

        $directions = ['inbound' => 0, 'outbound' => 0, 'internal' => 0];
        foreach ($directionCounts as $row) {
            $directions[$row['direction']] = (int)$row['count'];
        }

        return [
            'top_src_ips' => $topSrcIps,
            'top_dst_ips' => $topDstIps,
            'top_ports' => $topPorts,
            'protocol_breakdown' => $protocolBreakdown,
            'total_events' => (int)($totals['total_events'] ?? 0),
            'total_bytes' => (int)($totals['total_bytes'] ?? 0),
            'events_per_minute' => $eventsPerMinute,
            'inbound_count' => $directions['inbound'],
            'outbound_count' => $directions['outbound'],
            'internal_count' => $directions['internal'],
        ];
    }
}

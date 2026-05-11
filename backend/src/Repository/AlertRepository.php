<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Alert;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;

class AlertRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Alert::class);
    }

    public function createFilteredQueryBuilder(array $filters): QueryBuilder
    {
        $sortField = match ($filters['sort_by'] ?? '') {
            'severity' => 'a.severity',
            'status'   => 'a.status',
            'rule'     => 'a.ruleName',
            default    => 'a.timestamp',
        };
        $sortDir = strtoupper($filters['sort_dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        $qb = $this->createQueryBuilder('a')
            ->orderBy($sortField, $sortDir);

        if (!empty($filters['search'])) {
            $qb->andWhere('a.ruleName LIKE :search')
               ->setParameter('search', '%' . $filters['search'] . '%');
        }
        if (!empty($filters['status'])) {
            $qb->andWhere('a.status = :status')->setParameter('status', $filters['status']);
        }
        if (!empty($filters['severity'])) {
            $qb->andWhere('a.severity = :severity')->setParameter('severity', $filters['severity']);
        }
        if (!empty($filters['rule_id'])) {
            $qb->andWhere('a.ruleId = :ruleId')->setParameter('ruleId', $filters['rule_id']);
        }
        if (!empty($filters['from'])) {
            $qb->andWhere('a.timestamp >= :from')->setParameter('from', new \DateTimeImmutable($filters['from']));
        }
        if (!empty($filters['to'])) {
            $qb->andWhere('a.timestamp <= :to')->setParameter('to', new \DateTimeImmutable($filters['to']));
        }

        return $qb;
    }
}

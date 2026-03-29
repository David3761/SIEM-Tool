<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\MonitoringConfig;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class MonitoringConfigRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MonitoringConfig::class);
    }

    public function getSingleton(): MonitoringConfig
    {
        return $this->find(1) ?? new MonitoringConfig();
    }
}

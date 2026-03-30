<?php

declare(strict_types=1);

namespace App\Controller;

use App\Repository\MonitoringConfigRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/config')]
class ConfigController extends BaseApiController
{
    public function __construct(
        private readonly MonitoringConfigRepository $configRepository,
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('', methods: ['GET'])]
    public function show(): JsonResponse
    {
        $config = $this->configRepository->getSingleton();
        return $this->json($config->toArray());
    }

    #[Route('', methods: ['PUT'])]
    public function update(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];

        // Validate subnets
        if (isset($data['monitored_subnets'])) {
            foreach ($data['monitored_subnets'] as $cidr) {
                if (!$this->isValidCidr($cidr)) {
                    return $this->json([
                        'field' => 'monitored_subnets',
                        'error' => "Invalid CIDR: {$cidr}",
                    ], 422);
                }
            }
        }

        $config = $this->configRepository->getSingleton();

        if (isset($data['monitored_interfaces'])) {
            $config->setMonitoredInterfaces($data['monitored_interfaces']);
        }
        if (isset($data['monitored_subnets'])) {
            $config->setMonitoredSubnets($data['monitored_subnets']);
        }
        if (isset($data['excluded_ips'])) {
            $config->setExcludedIps($data['excluded_ips']);
        }

        $config->setUpdatedAt(new \DateTimeImmutable());

        if (!$this->em->contains($config)) {
            $this->em->persist($config);
        }

        $this->em->flush();

        return $this->json($config->toArray());
    }

    private function isValidCidr(string $cidr): bool
    {
        if (!str_contains($cidr, '/')) {
            return false;
        }

        [$ip, $prefix] = explode('/', $cidr, 2);

        if (!is_numeric($prefix)) {
            return false;
        }

        $prefix = (int)$prefix;

        // Try IPv4
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return $prefix >= 0 && $prefix <= 32;
        }

        // Try IPv6
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            return $prefix >= 0 && $prefix <= 128;
        }

        return false;
    }
}

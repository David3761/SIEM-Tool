<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Incident;
use App\Repository\AlertRepository;
use App\Repository\IncidentRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/incidents')]
class IncidentController extends BaseApiController
{
    public function __construct(
        private readonly IncidentRepository $incidentRepository,
        private readonly AlertRepository $alertRepository,
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];

        if (empty($data['title'])) {
            return $this->jsonError('title is required', 422);
        }

        $alertIds = $data['alert_ids'] ?? [];

        // Derive severity from alerts
        $severity = 'low';
        $severityRank = Incident::SEVERITY_RANK;
        foreach ($alertIds as $alertId) {
            $alert = $this->alertRepository->find($alertId);
            if ($alert && ($severityRank[$alert->getSeverity()] ?? 0) > ($severityRank[$severity] ?? 0)) {
                $severity = $alert->getSeverity();
            }
        }

        $incident = new Incident();
        $incident->setTitle($data['title']);
        $incident->setDescription($data['description'] ?? null);
        $incident->setSeverity($severity);
        $incident->setAlertIds($alertIds);

        $this->em->persist($incident);
        $this->em->flush();

        return $this->json($incident->toArray(), 201);
    }

    #[Route('', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $qb = $this->incidentRepository->createQueryBuilder('i')
            ->orderBy('i.createdAt', 'DESC');

        return $this->json($this->paginate($qb, $request));
    }

    #[Route('/{id}', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $incident = $this->incidentRepository->find($id);
        if (!$incident) {
            return $this->jsonError('Incident not found', 404);
        }
        return $this->json($incident->toArray());
    }

    #[Route('/{id}', methods: ['PATCH'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $incident = $this->incidentRepository->find($id);
        if (!$incident) {
            return $this->jsonError('Incident not found', 404);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $status = $data['status'] ?? null;

        if (!$status || !in_array($status, Incident::STATUSES, true)) {
            return $this->json([
                'error' => 'Invalid status value',
                'valid_values' => Incident::STATUSES,
            ], 422);
        }

        $incident->setStatus($status);
        $incident->setUpdatedAt(new \DateTimeImmutable());
        $this->em->flush();

        return $this->json($incident->toArray());
    }
}

<?php

declare(strict_types=1);

namespace App\Controller;

use App\Repository\NetworkEventRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class EventController extends BaseApiController
{
    public function __construct(
        private readonly NetworkEventRepository $eventRepository,
    ) {}

    #[Route('/api/events', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $filters = $request->query->all();
        $qb = $this->eventRepository->createFilteredQueryBuilder($filters);
        return $this->json($this->paginate($qb, $request));
    }

    #[Route('/api/events/{id}', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $event = $this->eventRepository->find($id);
        if (!$event) {
            return $this->jsonError('Event not found', 404);
        }
        return $this->json($event->toArray());
    }

    /**
     * GET /api/stats?range=15m|1h|6h|24h|7d
     */
    #[Route('/api/stats', methods: ['GET'])]
    public function stats(Request $request): JsonResponse
    {
        $range = $request->query->get('range', '1h');

        $since = match ($range) {
            '15m' => new \DateTimeImmutable('-15 minutes'),
            '6h'  => new \DateTimeImmutable('-6 hours'),
            '24h' => new \DateTimeImmutable('-24 hours'),
            '7d'  => new \DateTimeImmutable('-7 days'),
            default => new \DateTimeImmutable('-1 hour'),
        };

        return $this->json($this->eventRepository->getStats($since));
    }
}

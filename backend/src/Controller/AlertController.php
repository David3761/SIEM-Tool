<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Alert;
use App\Repository\AlertRepository;
use App\Repository\NetworkEventRepository;
use Doctrine\ORM\EntityManagerInterface;
use Dompdf\Dompdf;
use Dompdf\Options;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/alerts')]
class AlertController extends BaseApiController
{
    public function __construct(
        private readonly AlertRepository $alertRepository,
        private readonly NetworkEventRepository $eventRepository,
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $filters = $request->query->all();
        $qb = $this->alertRepository->createFilteredQueryBuilder($filters);
        $result = $this->paginate($qb, $request);

        // Enrich with triggering event data
        foreach ($result['items'] as &$item) {
            if (!empty($item['triggering_event_id'])) {
                $event = $this->eventRepository->find($item['triggering_event_id']);
                $item['triggering_event'] = $event?->toArray();
            }
        }

        return $this->json($result);
    }

    #[Route('/export', methods: ['GET'])]
    public function export(Request $request): Response
    {
        $format = $request->query->get('format', 'csv');
        $filters = $request->query->all();
        unset($filters['format']);

        $qb = $this->alertRepository->createFilteredQueryBuilder($filters);
        /** @var Alert[] $alerts */
        $alerts = $qb->getQuery()->getResult();

        if ($format === 'pdf') {
            return $this->exportPdf($alerts);
        }

        return $this->exportCsv($alerts);
    }

    #[Route('/{id}', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $alert = $this->alertRepository->find($id);
        if (!$alert) {
            return $this->jsonError('Alert not found', 404);
        }

        $triggeringEvent = null;
        if ($alert->getTriggeringEventId()) {
            $triggeringEvent = $this->eventRepository->find($alert->getTriggeringEventId());
        }

        return $this->json($alert->toArray($triggeringEvent));
    }

    #[Route('/{id}', methods: ['PATCH'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $alert = $this->alertRepository->find($id);
        if (!$alert) {
            return $this->jsonError('Alert not found', 404);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $status = $data['status'] ?? null;

        if (!$status || !in_array($status, Alert::STATUSES, true)) {
            return $this->json([
                'error' => 'Invalid status value',
                'valid_values' => Alert::STATUSES,
            ], 422);
        }

        $alert->setStatus($status);
        $this->em->flush();

        return $this->json($alert->toArray());
    }

    /** @param Alert[] $alerts */
    private function exportCsv(array $alerts): Response
    {
        $csv = Writer::createFromString();
        $csv->insertOne(['id', 'rule_name', 'severity', 'timestamp', 'status']);

        foreach ($alerts as $alert) {
            $csv->insertOne([
                $alert->getId(),
                $alert->getRuleName(),
                $alert->getSeverity(),
                $alert->getTimestamp()->format(\DateTimeInterface::ATOM),
                $alert->getStatus(),
            ]);
        }

        return new Response(
            $csv->toString(),
            200,
            [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="alerts.csv"',
            ]
        );
    }

    /** @param Alert[] $alerts */
    private function exportPdf(array $alerts): Response
    {
        $rows = '';
        foreach ($alerts as $alert) {
            $id = htmlspecialchars($alert->getId());
            $ruleName = htmlspecialchars($alert->getRuleName());
            $severity = htmlspecialchars($alert->getSeverity());
            $ts = $alert->getTimestamp()->format('Y-m-d H:i:s');
            $status = htmlspecialchars($alert->getStatus());
            $rows .= "<tr><td>{$id}</td><td>{$ruleName}</td><td>{$severity}</td><td>{$ts}</td><td>{$status}</td></tr>";
        }

        $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; }
  h1 { font-size: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
  th { background: #2d3748; color: white; }
  tr:nth-child(even) { background: #f7fafc; }
</style>
</head>
<body>
<h1>Alerts Export — {$ts}</h1>
<table>
  <thead><tr><th>ID</th><th>Rule Name</th><th>Severity</th><th>Timestamp</th><th>Status</th></tr></thead>
  <tbody>{$rows}</tbody>
</table>
</body>
</html>
HTML;

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        return new Response(
            $dompdf->output(),
            200,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="alerts.pdf"',
            ]
        );
    }
}

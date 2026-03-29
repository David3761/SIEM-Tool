<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Rule;
use App\Repository\RuleRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/rules')]
class RuleController extends BaseApiController
{
    public function __construct(
        private readonly RuleRepository $ruleRepository,
        private readonly EntityManagerInterface $em,
    ) {}

    #[Route('', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $qb = $this->ruleRepository->createQueryBuilder('r')
            ->where('r.enabled = true')
            ->orderBy('r.createdAt', 'DESC');

        return $this->json($this->paginate($qb, $request));
    }

    #[Route('', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];

        foreach (['name', 'rule_type', 'severity'] as $field) {
            if (empty($data[$field])) {
                return $this->jsonError("{$field} is required", 422);
            }
        }

        $rule = new Rule();
        $rule->setName($data['name']);
        $rule->setDescription($data['description'] ?? null);
        $rule->setRuleType($data['rule_type']);
        $rule->setSeverity($data['severity']);
        $rule->setConfig($data['config'] ?? []);
        $rule->setEnabled($data['enabled'] ?? true);

        $this->em->persist($rule);
        $this->em->flush();

        return $this->json($rule->toArray(), 201);
    }

    #[Route('/{id}', methods: ['PUT'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $rule = $this->ruleRepository->find($id);
        if (!$rule) {
            return $this->jsonError('Rule not found', 404);
        }

        $data = json_decode($request->getContent(), true) ?? [];

        if (isset($data['name'])) $rule->setName($data['name']);
        if (isset($data['description'])) $rule->setDescription($data['description']);
        if (isset($data['rule_type'])) $rule->setRuleType($data['rule_type']);
        if (isset($data['severity'])) $rule->setSeverity($data['severity']);
        if (isset($data['config'])) $rule->setConfig($data['config']);
        if (isset($data['enabled'])) $rule->setEnabled((bool)$data['enabled']);

        $this->em->flush();

        return $this->json($rule->toArray());
    }

    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $rule = $this->ruleRepository->find($id);
        if (!$rule) {
            return $this->jsonError('Rule not found', 404);
        }

        // Soft delete
        $rule->setEnabled(false);
        $this->em->flush();

        return $this->json(null, 204);
    }
}

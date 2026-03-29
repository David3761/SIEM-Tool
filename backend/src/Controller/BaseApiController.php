<?php

declare(strict_types=1);

namespace App\Controller;

use Doctrine\ORM\QueryBuilder;
use Doctrine\ORM\Tools\Pagination\Paginator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

abstract class BaseApiController extends AbstractController
{
    protected function paginate(QueryBuilder $qb, Request $request): array
    {
        $page = max(1, (int)$request->query->get('page', 1));
        $limit = min(200, max(1, (int)$request->query->get('limit', 50)));

        $qb->setFirstResult(($page - 1) * $limit)
            ->setMaxResults($limit);

        $paginator = new Paginator($qb);
        $total = count($paginator);

        $items = [];
        foreach ($paginator as $item) {
            $items[] = method_exists($item, 'toArray') ? $item->toArray() : $item;
        }

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => (int)ceil($total / $limit),
        ];
    }

    protected function jsonError(string $message, int $status = 400): JsonResponse
    {
        return $this->json(['error' => $message], $status);
    }
}

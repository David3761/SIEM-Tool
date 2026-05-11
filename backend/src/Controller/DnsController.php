<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class DnsController extends BaseApiController
{
    #[Route('/api/dns', name: 'api_dns_lookup', methods: ['GET'])]
    public function lookup(Request $request): JsonResponse
    {
        $ip = $request->query->getString('ip');

        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return $this->json(['hostname' => null]);
        }

        $result = gethostbyaddr($ip);
        // gethostbyaddr returns the original IP on failure
        $hostname = ($result !== false && $result !== $ip) ? $result : null;

        return $this->json(['hostname' => $hostname]);
    }
}

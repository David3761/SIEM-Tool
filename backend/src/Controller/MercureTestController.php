<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;
use Symfony\Component\Routing\Attribute\Route;

class MercureTestController extends AbstractController
{
    #[Route('/push', name: 'app_push')]
    public function publish(HubInterface $hub): Response
    {
        $update = new Update(
            'https://siem.local/alerts', // "Canalul" pe care trimitem
            json_encode(['message' => 'Alertă SIEM: Intrus detectat!', 'time' => date('H:i:s')])
        );

        $hub->publish($update);

        return new Response('Mesaj trimis cu succes!');
    }
}


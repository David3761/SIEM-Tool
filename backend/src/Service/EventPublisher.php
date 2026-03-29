<?php

namespace App\Service;

use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

class EventPublisher
{
    public function __construct(
        private readonly HubInterface $hub,
    ) {}

    public function publishTrafficEvent(array $eventData): void
    {
        $this->hub->publish(new Update(
            topics: ['traffic/events'],          // topic-ul la care se abonează browserul
            data:   json_encode([
                'type' => 'traffic_event',
                'data' => $eventData,
            ]),
        ));
    }

    public function publishNewAlert(array $alertData): void
    {
        $this->hub->publish(new Update(
            topics: ['alerts/new'],
            data:   json_encode([
                'type' => 'new_alert',
                'data' => $alertData,
            ]),
        ));
    }

    public function publishAlertUpdated(array $alertData): void
    {
        $this->hub->publish(new Update(
            topics: ['alerts/updated'],
            data:   json_encode([
                'type' => 'alert_updated',
                'data' => $alertData,
            ]),
        ));
    }
}

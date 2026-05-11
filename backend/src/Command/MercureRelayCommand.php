<?php

namespace App\Command;

use App\Service\EventPublisher;
use Predis\Client as PredisClient;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'app:mercure:relay',
    description: 'Citește din Redis și publică la hub-ul Mercure',
)]
class MercureRelayCommand extends Command
{
    public function __construct(
        private readonly EventPublisher $publisher,
        private readonly string $redisUrl,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $redis = new PredisClient($this->redisUrl);

        $output->writeln('<info>Relay pornit. Ascult Redis...</info>');

        // Throttle traffic events: max 10/sec toward Mercure
        $lastTrafficPublish = 0.0;
        $trafficIntervalMs  = 100; // ms between traffic publishes

        $pubsub = $redis->pubSubLoop();
        $pubsub->subscribe('traffic:events', 'alerts:new', 'alerts:updated');

        foreach ($pubsub as $message) {
            if ($message->kind !== 'message') {
                continue;
            }

            $data = json_decode($message->payload, true) ?? [];

            if ($message->channel === 'traffic:events') {
                $nowMs = (int)(microtime(true) * 1000);
                if ($nowMs - $lastTrafficPublish < $trafficIntervalMs) {
                    continue; // drop — throttled
                }
                $lastTrafficPublish = $nowMs;
                $this->publisher->publishTrafficEvent($data);
            } else {
                match ($message->channel) {
                    'alerts:new'     => $this->publisher->publishNewAlert($data),
                    'alerts:updated' => $this->publisher->publishAlertUpdated($data),
                    default          => null,
                };
                $output->writeln("[Relay] {$message->channel} → Mercure");
            }
        }

        return Command::SUCCESS;
    }
}

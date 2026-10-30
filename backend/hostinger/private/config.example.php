<?php
// Copy to config.php OUTSIDE public_html. Never commit credentials or private keys.
return [
    'dsn' => 'mysql:host=localhost;dbname=HOSTINGER_FLOWTRACK_DATABASE;charset=utf8mb4',
    'db_user' => 'HOSTINGER_FLOWTRACK_USER',
    'db_password' => '',
    'app_origin' => 'https://flowtrack.ikomeflow.com',
    'api_url' => 'https://ikomeflow.com/flowtrack-api/index.php',
    'app_secret' => '', // setup.php generates this once; keep it unchanged.
    'private_key_file' => __DIR__.'/offline-private.pem',
    'mail_from' => '', // Verified sender on your Hostinger domain; test delivery first.
    'admin_email' => 'ikome2flow@gmail.com',
    'payments_enabled' => false, // Enable only after staging verification.
    'payment_method' => [
        'id' => 'mtn-cameroon', 'provider' => 'MTN Mobile Money', 'country' => 'Cameroon',
        'recipient_name' => 'Ikome Ngalle Princewill Junior', 'recipient_number' => '678504189',
        'currency' => 'XAF', 'amount' => 600,
    ],
];

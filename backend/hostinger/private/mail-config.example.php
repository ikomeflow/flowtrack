<?php
// Copy to mail-config.php beside config.php, OUTSIDE public_html.
// For Hostinger: smtp.hostinger.com, ssl, 465, and your existing domain mailbox.
// Gmail requires an app password created by the mailbox owner, not the account password.
return [
    'host' => 'smtp.gmail.com',
    'security' => 'tls',
    'port' => 587,
    'username' => 'ikome2flow@gmail.com',
    'password_file' => __DIR__.'/mail-password.txt',
];

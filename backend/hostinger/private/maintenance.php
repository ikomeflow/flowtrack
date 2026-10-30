<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
$config=require __DIR__.'/config.php';
$db=new PDO($config['dsn'],$config['db_user'],$config['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$now=time();
foreach (['ft_sessions'=>'expires_at','ft_rate_limits'=>'expires_at','ft_tokens'=>'expires_at'] as $table=>$column) {
    $statement=$db->prepare("DELETE FROM $table WHERE $column < ?");$statement->execute([$now-86400]);
}
echo "Expired temporary authentication data cleaned. Accounts, payments and audit records preserved.\n";

<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404);exit; }
// Run once with `php setup.php`, after filling config.php in the private folder.
umask(0077);
$configFile=__DIR__.'/config.php';
if (!is_file($configFile)) throw new RuntimeException('Copy config.example.php to config.php and fill database and sender details first.');
$config=require $configFile;
if (!str_starts_with($config['dsn']??'','mysql:') || !filter_var($config['mail_from']??'',FILTER_VALIDATE_EMAIL) || !$config['db_user'] || !$config['db_password']) throw new RuntimeException('Database and sender details are required.');
if (!$config['app_secret']) { $config['app_secret']=bin2hex(random_bytes(32));file_put_contents($configFile,"<?php\nreturn ".var_export($config,true).";\n",LOCK_EX); }
chmod($configFile,0600);
if (!is_file($config['private_key_file'])) {
    $key=openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_RSA,'private_key_bits'=>2048]);
    if (!$key || !openssl_pkey_export($key,$pem)) throw new RuntimeException('RSA key creation failed.');
    if (file_put_contents($config['private_key_file'],$pem,LOCK_EX)===false) throw new RuntimeException('Could not save signing key.');
    chmod($config['private_key_file'],0600);
}
$key=openssl_pkey_get_private(file_get_contents($config['private_key_file']));$details=openssl_pkey_get_details($key);
if ($details['type']!==OPENSSL_KEYTYPE_RSA || $details['bits']<2048) throw new RuntimeException('Invalid signing key.');
$encode=static fn(string $value):string=>rtrim(strtr(base64_encode($value),'+/','-_'),'=');
$public=['kty'=>'RSA','alg'=>'RS256','use'=>'sig','n'=>$encode($details['rsa']['n']),'e'=>$encode($details['rsa']['e'])];
$db=new PDO($config['dsn'],$config['db_user'],$config['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach (explode(';',file_get_contents(__DIR__.'/schema.sql')) as $sql) if (trim($sql)!=='') $db->exec($sql);
file_put_contents(__DIR__.'/public-config.json',json_encode(['enabled'=>false,'apiUrl'=>$config['api_url'],'offlinePublicKey'=>$public],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n",LOCK_EX);
echo "FlowTrack schema and private keys are ready. public-config.json contains only browser-safe settings. Subscriptions remain disabled until staging tests pass.\n";

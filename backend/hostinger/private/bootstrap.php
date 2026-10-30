<?php
declare(strict_types=1);
require_once __DIR__.'/Service.php';
$flowtrackConfig=require __DIR__.'/config.php';
if (strlen($flowtrackConfig['app_secret']??'')<64 || !is_file($flowtrackConfig['private_key_file']??'') || !filter_var($flowtrackConfig['mail_from']??'',FILTER_VALIDATE_EMAIL)) throw new RuntimeException('FlowTrack setup incomplete');
$flowtrackMailer = null;
if (is_file(__DIR__.'/mail-config.php')) {
    require_once __DIR__.'/SmtpMailer.php';
    $flowtrackMailer = \FlowTrack\SmtpMailer::transport(require __DIR__.'/mail-config.php');
}
return new \FlowTrack\Service(new PDO($flowtrackConfig['dsn'],$flowtrackConfig['db_user'],$flowtrackConfig['db_password'],[PDO::ATTR_EMULATE_PREPARES=>false]),$flowtrackConfig,null,$flowtrackMailer);

<?php
declare(strict_types=1);
namespace FlowTrack;

require_once __DIR__.'/vendor/phpmailer/Exception.php';
require_once __DIR__.'/vendor/phpmailer/PHPMailer.php';
require_once __DIR__.'/vendor/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

final class SmtpMailer {
    /** A private mailbox configuration; no settings are accepted from API requests. */
    public static function message(array $settings, string $to, string $subject, string $body): PHPMailer {
        $host = $settings['host'] ?? '';
        $user = $settings['username'] ?? '';
        $security = $settings['security'] ?? '';
        $port = $settings['port'] ?? 0;
        if (!in_array($host, ['smtp.gmail.com', 'smtp.hostinger.com'], true)
            || !filter_var($user, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $user)
            || !in_array([$security, $port], [['tls', 587], ['ssl', 465]], true)) {
            throw new \RuntimeException('Invalid private SMTP configuration');
        }
        $file = $settings['password_file'] ?? '';
        if (!is_string($file) || !is_file($file) || !is_readable($file) || filesize($file) > 1024) {
            throw new \RuntimeException('SMTP credential is unavailable');
        }
        $password = rtrim(file_get_contents($file), "\r\n");
        if ($host === 'smtp.gmail.com') $password = str_replace(' ', '', $password);
        if ($password === '' || strpbrk($password, "\r\n\0") !== false) throw new \RuntimeException('SMTP credential is unavailable');
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->Port = $port;
        $mail->SMTPSecure = $security;
        $mail->SMTPAuth = true;
        $mail->Username = $user;
        $mail->Password = $password;
        $mail->SMTPDebug = 0;
        $mail->SMTPKeepAlive = false;
        $mail->Timeout = 10;
        $mail->getSMTPInstance()->Timelimit = 15;
        $mail->SMTPOptions = ['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false]];
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->Encoding = PHPMailer::ENCODING_BASE64;
        $mail->XMailer = '';
        $mail->setFrom($user, 'FlowTrack');
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->addCustomHeader('X-Auto-Response-Suppress', 'All');
        return $mail;
    }

    public static function failureStatus(\Throwable $error, ?PHPMailer $mail = null): array {
        $message = strtolower($error->getMessage());
        $category = str_contains($message, 'authenticate') ? 'authentication'
            : (str_contains($message, 'credential') ? 'credential_unavailable'
            : (str_contains($message, 'configuration') ? 'configuration'
            : ((str_contains($message, 'connect') || str_contains($message, 'tls')) ? 'connection_or_tls' : 'delivery')));
        $code = $mail?->getSMTPInstance()->getError()['smtp_code'] ?? '';
        return ['time' => gmdate('c'), 'status' => 'failed', 'category' => $category,
            'smtp_code' => preg_match('/^[0-9]{3}$/D', (string)$code) ? (int)$code : null];
    }

    private static function recordStatus(array $status): void {
        // A private operational status only: no addresses, message text, links or credentials.
        @file_put_contents(__DIR__.'/mail-status.json', json_encode($status, JSON_THROW_ON_ERROR), LOCK_EX);
        @chmod(__DIR__.'/mail-status.json', 0600);
    }

    public static function transport(array $settings): \Closure {
        return static function(string $to, string $subject, string $body) use ($settings): void {
            $mail = null;
            try {
                $mail = self::message($settings, $to, $subject, $body);
                if (!$mail->send()) throw new \RuntimeException('SMTP send rejected');
                self::recordStatus(['time' => gmdate('c'), 'status' => 'sent']);
            } catch (\Throwable $error) {
                // Mailer diagnostics can contain credentials or confirmation links; never expose them.
                $status = self::failureStatus($error, $mail);
                self::recordStatus($status);
                error_log('FlowTrack SMTP failure: '.$status['category'].' ('.($status['smtp_code'] ?? 'no SMTP reply').')');
                throw new ApiError('Email could not be sent. Your account is preserved. Please try Resend confirmation later or contact support.', 503);
            }
        };
    }
}

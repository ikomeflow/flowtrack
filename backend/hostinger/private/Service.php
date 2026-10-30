<?php
declare(strict_types=1);

namespace FlowTrack;

use PDO;
use RuntimeException;
use DateTimeImmutable;
use DateTimeZone;

final class ApiError extends RuntimeException {
    public function __construct(string $message, public readonly int $status = 400) { parent::__construct($message); }
}

/** No financial records, ledger PINs or recovery keys are accepted by this service. */
final class Service {
    private $clock;
    private $mailer;
    public function __construct(private PDO $db, private array $config, ?callable $clock = null, ?callable $mailer = null) {
        $this->clock = $clock ?? static fn(): int => time();
        $this->mailer = $mailer ?? static function(string $to, string $subject, string $body) use ($config): void {
            $from = $config['mail_from'];
            if (!filter_var($from, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $from)) throw new RuntimeException('Invalid sender');
            if (!mail($to, $subject, $body, ['From' => 'FlowTrack <'.$from.'>', 'Content-Type' => 'text/plain; charset=UTF-8', 'X-Auto-Response-Suppress' => 'All'])) {
                throw new RuntimeException('Email delivery failed');
            }
        };
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') $db->exec("SET time_zone = '+00:00'");
    }
    public function now(): int { return ($this->clock)(); }
    private function id(): string { return bin2hex(random_bytes(16)); }
    private function hash(string $value): string { return hash_hmac('sha256', $value, $this->config['app_secret']); }
    private function query(string $sql, array $params = []): \PDOStatement { $statement = $this->db->prepare($sql); $statement->execute($params); return $statement; }
    private function one(string $sql, array $params = []): ?array { return $this->query($sql, $params)->fetch() ?: null; }
    private function lock(): string { return $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''; }
    private function transaction(callable $fn): mixed {
        $this->db->beginTransaction();
        try { $result = $fn(); $this->db->commit(); return $result; }
        catch (\Throwable $error) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $error; }
    }
    private function email(mixed $value): string {
        if (!is_string($value)) throw new ApiError('Enter a valid email address.');
        $email = strtolower(trim($value));
        if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[^\x20-\x7E]/', $email)) throw new ApiError('Enter a valid email address.');
        return $email;
    }
    private function password(mixed $value): string {
        if (!is_string($value) || strlen($value) > 72 || !preg_match('/^.{12,72}$/usD',$value) || str_contains($value, "\0")) throw new ApiError('Use at least 12 characters and at most 72 bytes. Some non-English characters use several bytes.');
        return $value;
    }
    private function passwordHash(string $password): string {
        return defined('PASSWORD_ARGON2ID') ? password_hash($password, PASSWORD_ARGON2ID, ['memory_cost' => 65536, 'time_cost' => 3, 'threads' => 1]) : password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }
    private function rate(string $scope, string $key, int $limit, int $window): void {
        $bucket = $this->hash($scope.':'.$key.':'.intdiv($this->now(), $window));
        $expiry = $this->now() + $window;
        $sql = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
            ? 'INSERT INTO ft_rate_limits (bucket, hits, expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1'
            : 'INSERT INTO ft_rate_limits (bucket, hits, expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1';
        $this->query($sql, [$bucket, $expiry]);
        if ((int)$this->one('SELECT hits FROM ft_rate_limits WHERE bucket=?', [$bucket])['hits'] > $limit) throw new ApiError('Too many attempts. Please wait before trying again.', 429);
    }
    private function audit(string $action, ?string $user, ?string $payment = null): void {
        $this->query('INSERT INTO ft_audit (id,actor_id,action,payment_id,created_at) VALUES (?,?,?,?,?)', [$this->id(), $user, $action, $payment, $this->now()]);
    }
    public function newSession(?array $user = null): array {
        $cookie = bin2hex(random_bytes(32)); $csrf = bin2hex(random_bytes(32));
        $row = ['id' => $this->hash($cookie), 'user_id' => $user['id'] ?? null, 'csrf' => $csrf, 'created_at' => $this->now(), 'last_seen_at' => $this->now(), 'expires_at' => $this->now() + ($user ? 43200 : 3600), 'admin_verified_at' => null];
        $this->query('INSERT INTO ft_sessions (id,user_id,csrf,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?)', [$row['id'], $row['user_id'], $csrf, $row['created_at'], $row['last_seen_at'], $row['expires_at']]);
        return ['cookie' => $cookie, 'session' => $row];
    }
    public function session(?string $cookie): ?array {
        if (!$cookie || !preg_match('/^[a-f0-9]{64}$/D', $cookie)) return null;
        $session = $this->one('SELECT * FROM ft_sessions WHERE id=?', [$this->hash($cookie)]);
        if (!$session || (int)$session['expires_at'] <= $this->now() || (int)$session['last_seen_at'] + 3600 <= $this->now()) return null;
        $this->query('UPDATE ft_sessions SET last_seen_at=? WHERE id=?', [$this->now(), $session['id']]);
        return $session;
    }
    private function user(array $session): array {
        $user = !empty($session['user_id']) ? $this->one('SELECT * FROM ft_users WHERE id=?', [$session['user_id']]) : null;
        if (!$user || $user['verified_at'] === null || (int)$session['expires_at'] <= $this->now()) throw new ApiError('Sign in with a verified email to continue.', 401);
        return $user;
    }
    private function admin(array $session): array {
        $user = $this->user($session);
        if (!(bool)$user['is_admin']) throw new ApiError('Administrator access required.', 403);
        if (!$session['admin_verified_at'] || (int)$session['admin_verified_at'] + 600 <= $this->now()) throw new ApiError('Verify a fresh admin email code first.', 403);
        return $user;
    }
    private function token(string $userId, string $purpose, int $lifetime, ?string $sessionId = null): string {
        $value = $purpose === 'admin' ? str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT) : bin2hex(random_bytes(32));
        $this->query('UPDATE ft_tokens SET used_at=? WHERE user_id=? AND purpose=? AND used_at IS NULL', [$this->now(), $userId, $purpose]);
        $this->query('INSERT INTO ft_tokens (id,user_id,purpose,token_hash,session_id,expires_at) VALUES (?,?,?,?,?,?)', [$this->id(), $userId, $purpose, $this->hash($purpose.':'.($sessionId ?? '').':'.$value), $sessionId, $this->now() + $lifetime]);
        return $value;
    }
    private function consume(string $purpose, mixed $value, ?string $sessionId = null): array {
        if (!is_string($value) || !preg_match($purpose === 'admin' ? '/^[0-9]{6}$/D' : '/^[a-f0-9]{64}$/D', $value)) throw new ApiError('The link or code is invalid or expired. Request a new one.');
        $token = $this->one('SELECT * FROM ft_tokens WHERE purpose=? AND token_hash=?'.$this->lock(), [$purpose, $this->hash($purpose.':'.($sessionId ?? '').':'.$value)]);
        if (!$token || $token['used_at'] !== null || (int)$token['expires_at'] <= $this->now()) throw new ApiError('The link or code is invalid or expired. Request a new one.');
        $this->query('UPDATE ft_tokens SET used_at=? WHERE id=?', [$this->now(), $token['id']]);
        return $token;
    }
    private function sendLink(array $user, string $purpose): void {
        $token = $this->token($user['id'], $purpose, $purpose === 'verify' ? 86400 : 1800);
        $link = rtrim($this->config['app_origin'], '/').'/account.html#account-'.$purpose.'='.$token;
        $label = $purpose === 'verify' ? 'Confirm your FlowTrack email' : 'Reset your FlowTrack account password';
        $this->sendMail($user['email'], $label, $label."\n\n".$link."\n\nThis link can be used once. It does not recover your local ledger PIN. If you did not request this, ignore this email.\n");
    }
    private function sendMail(string $to,string $subject,string $body):void {
        // Leave headroom under Hostinger's shared PHP-mail quota. No marketing mail.
        $this->rate('outgoing-minute','flowtrack',8,60);
        $this->rate('outgoing-day','flowtrack',80,86400);
        ($this->mailer)($to,$subject,$body);
    }
    public function register(array $input, string $ip): array {
        $email = $this->email($input['email'] ?? null); $password = $this->password($input['password'] ?? null);
        $this->rate('register-ip', $ip, 5, 3600); $this->rate('register-email', $email, 3, 3600);
        $hash = $this->passwordHash($password);
        $user = $this->one('SELECT * FROM ft_users WHERE email=?', [$email]);
        if (!$user) {
            $user = ['id' => $this->id(), 'email' => $email];
            $registered = $this->now();
            try { $this->query('INSERT INTO ft_users (id,email,password_hash,registered_at,trial_ends_at) VALUES (?,?,?,?,?)', [$user['id'], $email, $hash, $registered, $registered+30*86400]); }
            catch (\PDOException $error) { if ($error->getCode() !== '23000') throw $error; return ['message' => 'If this address can be registered, a confirmation email will arrive shortly. Otherwise, sign in or reset your password.']; }
            $this->audit('registered', $user['id']); $this->sendLink($user, 'verify');
        }
        return ['message' => 'If this address can be registered, a confirmation email will arrive shortly. Otherwise, sign in or reset your password.'];
    }
    public function verify(array $input, string $ip): array {
        $this->rate('verify-ip', $ip, 20, 900);
        return $this->transaction(function() use ($input): array {
            $token = $this->consume('verify', $input['token'] ?? null);
            $user = $this->one('SELECT * FROM ft_users WHERE id=?'.$this->lock(), [$token['user_id']]);
            $isAdmin = hash_equals(strtolower($this->config['admin_email']), $user['email']) ? 1 : 0;
            $this->query('UPDATE ft_users SET verified_at=COALESCE(verified_at,?),is_admin=? WHERE id=?', [$this->now(), $isAdmin, $user['id']]);
            $this->audit('email_verified', $user['id']); return ['message' => 'Email confirmed. Sign in to use your trial.'];
        });
    }
    public function login(array $input, string $ip, array $oldSession): array {
        $email = $this->email($input['email'] ?? null); $password = $input['password'] ?? '';
        if (!is_string($password) || strlen($password) > 1024) throw new ApiError('Email or password is incorrect.', 401);
        $this->rate('login-ip', $ip, 30, 900); $this->rate('login-email', $email, 10, 900);
        $user = $this->one('SELECT * FROM ft_users WHERE email=?', [$email]);
        $dummy = '$2y$12$5V9WJK.Sv3zV/ZzXcs3aXO5/UGgJSbSGxrlL8C8Eq50CPb9.YP9ba';
        if (!password_verify($password, $user['password_hash'] ?? $dummy) || !$user) throw new ApiError('Email or password is incorrect.', 401);
        if ($user['verified_at'] === null) throw new ApiError('Confirm your email before signing in. Use Resend confirmation if needed.', 403);
        // Lock the account before creating a session so password-reset revocation cannot race login.
        return $this->transaction(function() use ($user, $oldSession): array {
            $current = $this->one('SELECT * FROM ft_users WHERE id=?'.$this->lock(), [$user['id']]);
            if (!hash_equals($user['password_hash'], $current['password_hash'])) throw new ApiError('Password changed. Sign in again.', 401);
            $this->query('DELETE FROM ft_sessions WHERE id=?', [$oldSession['id']]);
            $this->audit('signed_in', $user['id']); return $this->newSession($current);
        });
    }
    public function logout(array $session): array { $this->query('DELETE FROM ft_sessions WHERE id=?', [$session['id']]); return ['message' => 'Signed out on this device.']; }
    public function requestLink(array $input, string $ip, string $purpose): array {
        $email = $this->email($input['email'] ?? null); $this->rate('email-ip', $ip, 10, 3600); $this->rate('email-address', $email, 3, 3600);
        $user = $this->one('SELECT * FROM ft_users WHERE email=?', [$email]);
        if ($user && ($purpose === 'reset' ? $user['verified_at'] !== null : $user['verified_at'] === null)) $this->sendLink($user, $purpose);
        return ['message' => 'If the address is eligible, an email will arrive shortly.'];
    }
    public function reset(array $input, string $ip): array {
        $this->rate('reset-ip', $ip, 10, 900); $hash = $this->passwordHash($this->password($input['password'] ?? null));
        return $this->transaction(function() use ($input, $hash): array {
            $token = $this->consume('reset', $input['token'] ?? null);
            $this->one('SELECT id FROM ft_users WHERE id=?'.$this->lock(), [$token['user_id']]);
            $this->query('UPDATE ft_users SET password_hash=? WHERE id=?', [$hash, $token['user_id']]);
            $this->query('DELETE FROM ft_sessions WHERE user_id=?', [$token['user_id']]);
            $this->query('UPDATE ft_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL', [$this->now(), $token['user_id']]);
            $this->audit('password_reset', $token['user_id']); return ['message' => 'Password changed. Sign in again. Your ledger PIN is unchanged.'];
        });
    }
    private function entitlement(array $user, array $session): array {
        $until = max((int)$user['trial_ends_at'], (int)($user['paid_until'] ?? 0));
        return ['user_id' => $user['id'], 'registered_at' => gmdate('c', (int)$user['registered_at']), 'trial_ends_at' => gmdate('c', (int)$user['trial_ends_at']), 'paid_until' => $user['paid_until'] ? gmdate('c', (int)$user['paid_until']) : null, 'server_time' => gmdate('c', $this->now()), 'access_until' => gmdate('c', $until), 'can_write' => $until > $this->now(), 'is_admin' => (bool)$user['is_admin'], 'admin_verified' => (bool)$user['is_admin'] && (int)($session['admin_verified_at'] ?? 0) + 600 > $this->now()];
    }
    private function lease(array $user): ?string {
        $until = min(max((int)$user['trial_ends_at'], (int)($user['paid_until'] ?? 0)), $this->now()+7*86400);
        if ($until <= $this->now()) return null;
        $message = self::base64url(json_encode(['alg'=>'RS256', 'typ'=>'JWT'], JSON_THROW_ON_ERROR)).'.'.self::base64url(json_encode(['iss'=>$this->config['api_url'], 'aud'=>'flowtrack-offline', 'sub'=>$user['id'], 'iat'=>$this->now(), 'exp'=>$until, 'write'=>true], JSON_THROW_ON_ERROR));
        $private = file_get_contents($this->config['private_key_file']);
        if (!$private || !openssl_sign($message, $signature, $private, OPENSSL_ALGO_SHA256)) throw new RuntimeException('Offline signing unavailable');
        return $message.'.'.self::base64url($signature);
    }
    public static function base64url(string $value): string { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }
    public function snapshot(array $session): array {
        if (empty($session['user_id'])) return ['user'=>null, 'csrf'=>$session['csrf'], 'entitlement'=>null, 'lease'=>null, 'methods'=>[], 'payments'=>[]];
        $user = $this->user($session);
        $payments = $this->query('SELECT id,user_id,provider,reference,sender_number,amount,currency,status,submitted_at,reviewed_at,review_note,access_until FROM ft_payments WHERE user_id=? ORDER BY submitted_at DESC,id DESC LIMIT 100', [$user['id']])->fetchAll();
        return ['user'=>['id'=>$user['id'], 'email'=>$user['email']], 'csrf'=>$session['csrf'], 'entitlement'=>$this->entitlement($user,$session), 'lease'=>$this->lease($user), 'methods'=>$this->config['payments_enabled']?[$this->config['payment_method']]:[], 'payments'=>$this->dates($payments)];
    }
    private function dates(array $rows): array {
        foreach ($rows as &$row) foreach (['submitted_at','reviewed_at','access_until'] as $field) if (array_key_exists($field,$row)) $row[$field] = $row[$field] ? gmdate('c',(int)$row[$field]) : null;
        return $rows;
    }
    public function submitPayment(array $session, array $input): array {
        $user = $this->user($session); $this->rate('payment-user',$user['id'],5,3600);
        $method = $this->config['payment_method'];
        if (($input['method'] ?? null) !== $method['id'] || empty($this->config['payments_enabled'])) throw new ApiError('This payment method is unavailable.');
        $reference = strtoupper(trim(is_string($input['reference'] ?? null) ? $input['reference'] : ''));
        $sender = trim(is_string($input['sender'] ?? null) ? $input['sender'] : '');
        if (!preg_match('/^[A-Z0-9-]{4,100}$/D',$reference) || !preg_match('/^\+?[0-9 ()-]{7,30}$/D',$sender)) throw new ApiError('Check the transaction reference and sender number.');
        try { return $this->transaction(function() use ($user,$method,$reference,$sender): array {
            $this->one('SELECT id FROM ft_users WHERE id=?'.$this->lock(),[$user['id']]);
            if ($this->one("SELECT id FROM ft_payments WHERE user_id=? AND status='pending'",[$user['id']])) throw new ApiError('You already have a payment awaiting review.',409);
            $id=$this->id();
            $this->query("INSERT INTO ft_payments (id,user_id,provider,reference,sender_number,amount,currency,status,submitted_at) VALUES (?,?,?,?,?,?,?,'pending',?)",[$id,$user['id'],$method['provider'],$reference,$sender,$method['amount'],$method['currency'],$this->now()]);
            $this->audit('payment_submitted',$user['id'],$id);return ['message'=>'Payment submitted for admin verification.','id'=>$id];
        }); } catch (\PDOException $error) { if ($error->getCode()==='23000') throw new ApiError('This transaction reference has already been submitted.',409);throw $error; }
    }
    public function adminCode(array $session, string $ip): array {
        $user=$this->user($session);if (!(bool)$user['is_admin']) throw new ApiError('Administrator access required.',403);
        $this->rate('admin-send-ip',$ip,5,900);$this->rate('admin-send-user',$user['id'],3,600);
        $code=$this->token($user['id'],'admin',300,$session['id']);
        $this->sendMail($user['email'],'FlowTrack admin verification code',"Your FlowTrack admin code is: ".$code."\n\nIt expires in 5 minutes. Only enter it in FlowTrack. This code allows payment reviews for 10 minutes. Do not share it.\n");
        return ['message'=>'A 5-minute admin verification code has been sent to your email.'];
    }
    public function adminVerify(array $session, array $input, string $ip): array {
        $user=$this->user($session);if (!(bool)$user['is_admin']) throw new ApiError('Administrator access required.',403);
        $this->rate('admin-verify-ip',$ip,10,600);$this->rate('admin-verify-user',$user['id'],5,600);
        return $this->transaction(function() use($session,$input,$user):array {
            $token=$this->consume('admin',$input['code']??null,$session['id']);
            if (!hash_equals($user['id'],$token['user_id'])) throw new ApiError('Invalid verification code.',403);
            $this->query('UPDATE ft_sessions SET admin_verified_at=? WHERE id=?',[$this->now(),$session['id']]);
            $this->audit('admin_verified',$user['id']);return ['message'=>'Admin access verified for 10 minutes.'];
        });
    }
    public function pendingPayments(array $session): array {
        $this->admin($session);
        return ['payments'=>$this->dates($this->query("SELECT p.*,u.email FROM ft_payments p JOIN ft_users u ON u.id=p.user_id WHERE p.status='pending' ORDER BY p.submitted_at,p.id LIMIT 100")->fetchAll())];
    }
    public static function addMonth(int $timestamp): int {
        $start=(new DateTimeImmutable('@'.$timestamp))->setTimezone(new DateTimeZone('UTC'));
        $next=$start->modify('first day of next month');
        return $next->setDate((int)$next->format('Y'),(int)$next->format('m'),min((int)$start->format('d'),(int)$next->format('t')))->getTimestamp();
    }
    public function reviewPayment(array $session,array $input):array {
        $admin=$this->admin($session);$id=$input['id']??'';$approve=$input['approve']??null;$note=trim(is_string($input['note']??null)?$input['note']:'');
        if (!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)||!is_bool($approve)||strlen($note)<3||strlen($note)>500) throw new ApiError('Add a review note between 3 and 500 characters.');
        return $this->transaction(function() use($admin,$id,$approve,$note):array {
            $payment=$this->one('SELECT * FROM ft_payments WHERE id=?'.$this->lock(),[$id]);if (!$payment) throw new ApiError('Payment not found.',404);
            $status=$approve?'approved':'rejected';
            if ($payment['status']!=='pending') { if ($payment['status']===$status)return ['message'=>'This payment was already '.$status.'.'];throw new ApiError('This payment has already been reviewed.',409); }
            $user=$this->one('SELECT * FROM ft_users WHERE id=?'.$this->lock(),[$payment['user_id']]);$until=null;
            if ($approve) {
                $until=self::addMonth(max($this->now(),(int)$user['trial_ends_at'],(int)($user['paid_until']??0)));
                $this->query('UPDATE ft_users SET paid_until=? WHERE id=?',[$until,$user['id']]);
            }
            $this->query('UPDATE ft_payments SET status=?,reviewed_at=?,reviewed_by=?,review_note=?,access_until=? WHERE id=?',[$status,$this->now(),$admin['id'],$note,$until,$id]);
            $this->audit('payment_'.$status,$admin['id'],$id);return ['message'=>'Payment '.$status.'.','access_until'=>$until?gmdate('c',$until):null];
        });
    }
}

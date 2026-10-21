<?php
/**
 * NafisStore B2B - Secure Host API (v4.4 - Security Fixes & Logistics Consolidated)
 * Changes vs v4.3:
 *  - get_settings no longer leaks full bot_token (masked only)
 *  - client_ip trusts CF header only for real Cloudflare IPs (anti-spoof)
 *  - merged duplicate logistics functions into calculate_default_logistics
 *  - single source of default FX rates via constants
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

define('API_VERSION', '2026.10.21-v5.1-channel-autopost');
define('ROOT_DIR', __DIR__);
define('DATA_DIR', __DIR__ . '/data');
define('UPLOADS_DIR', __DIR__ . '/uploads');
define('SITE_ORIGIN', 'https://nfs.nafisstore.com');

define('DEFAULT_USD_RATE', 268300);
define('DEFAULT_AED_RATE', 73440);
define('DEFAULT_CNY_RATE', 40200);

if (!function_exists('mb_substr')) {
    function mb_substr($s, $start, $length = null, $enc = null)
    {
        if (preg_match_all('/./us', (string)$s, $m)) {
            return implode('', array_slice($m[0], $start, $length));
        }
        return substr((string)$s, $start, $length);
    }
}
if (!function_exists('mb_strtolower')) {
    function mb_strtolower($s, $enc = null)
    {
        return strtolower((string)$s);
    }
}

/* ------------------------------------------------------------------ */
/* Secrets                                                              */
/* ------------------------------------------------------------------ */
$GLOBALS['NFS_SECRETS'] = [];
$secretsFile = dirname(__DIR__) . '/nfs-secrets.php';
if (is_file($secretsFile)) {
    $loaded = include $secretsFile;
    if (is_array($loaded)) {
        $GLOBALS['NFS_SECRETS'] = $loaded;
    }
}

function secret($key)
{
    $env = getenv('NFS_' . strtoupper($key));
    if ($env !== false && $env !== '') {
        return (string)$env;
    }
    return isset($GLOBALS['NFS_SECRETS'][$key]) ? (string)$GLOBALS['NFS_SECRETS'][$key] : '';
}

/* ------------------------------------------------------------------ */
/* Directories                                                          */
/* ------------------------------------------------------------------ */
function ensure_dir($dir, $htaccess)
{
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $f = $dir . '/.htaccess';
    if (!is_file($f)) {
        @file_put_contents($f, $htaccess);
    }
}

ensure_dir(DATA_DIR, <<<'HT'
Require all denied
<IfModule !mod_authz_core.c>
Order allow,deny
Deny from all
</IfModule>
HT
);

ensure_dir(UPLOADS_DIR, <<<'HT'
Options -ExecCGI -Indexes
RemoveHandler .php .phtml .phar
<FilesMatch "\.(php|phtml|phar|php[0-9])$">
Require all denied
</FilesMatch>
HT
);

$CATALOG_FILE  = DATA_DIR . '/catalog.json';
$RATES_FILE    = DATA_DIR . '/rates.json';
$SETTINGS_FILE = DATA_DIR . '/settings.json';
$CRM_FILE      = DATA_DIR . '/crm.json';
$QUEUE_FILE    = DATA_DIR . '/queue.json';

/* ------------------------------------------------------------------ */
/* Response helpers                                                     */
/* ------------------------------------------------------------------ */
function out($data, $code = 200)
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail($msg, $code = 400)
{
    out(['success' => false, 'error' => $msg], $code);
}

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Vary: Origin');
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origin === SITE_ORIGIN) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Admin-Key, X-Ingest-Key');
}
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawBody = file_get_contents('php://input');
if (strlen($rawBody) > 12 * 1024 * 1024) {
    fail('Payload too large', 413);
}
$body = json_decode($rawBody, true);
if (!is_array($body)) {
    $body = [];
}
$action = isset($_GET['action']) ? (string)$_GET['action'] : (isset($body['action']) ? (string)$body['action'] : '');
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */
function header_val($name)
{
    $k = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$k]) ? (string)$_SERVER[$k] : '';
}

function require_admin()
{
    $key = secret('admin_key');
    if (strlen($key) < 16) {
        fail('Server is not configured (admin_key missing or too short)', 503);
    }
    if (!hash_equals($key, header_val('X-Admin-Key'))) {
        usleep(400000);
        fail('Unauthorized', 401);
    }
}

function require_ingest()
{
    $ik = secret('ingest_key');
    if (strlen($ik) >= 16 && hash_equals($ik, header_val('X-Ingest-Key'))) {
        return;
    }
    require_admin();
}

/* ------------------------------------------------------------------ */
/* Storage                                                              */
/* ------------------------------------------------------------------ */
function read_json($file, $default)
{
    if (!is_file($file)) {
        return $default;
    }
    $fp = @fopen($file, 'r');
    if (!$fp) {
        return $default;
    }
    flock($fp, LOCK_SH);
    $c = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $d = json_decode((string)$c, true);
    return $d === null ? $default : $d;
}

function write_json($file, $data)
{
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, $json, LOCK_EX) === false) {
        return false;
    }
    return rename($tmp, $file);
}

function with_lock($name, $fn)
{
    $fp = fopen(DATA_DIR . '/' . $name . '.lock', 'c');
    flock($fp, LOCK_EX);
    try {
        return $fn();
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

/* ------------------------------------------------------------------ */
/* Client IP (FIXED: trusts CF header only for real Cloudflare IPs)     */
/* ------------------------------------------------------------------ */
function is_real_cloudflare_request()
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    $cfRanges = [
        '173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22',
        '141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20',
        '197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/13',
        '104.24.0.0/14','172.64.0.0/13','131.0.72.0/22',
    ];
    $ipLong = ip2long($ip);
    if ($ipLong === false) {
        return false;
    }
    foreach ($cfRanges as $range) {
        list($net, $mask) = explode('/', $range);
        $netLong = ip2long($net);
        if ($netLong === false) {
            continue;
        }
        $maskBits = (int)$mask;
        $maskLong = ~((1 << (32 - $maskBits)) - 1) & 0xFFFFFFFF;
        if (($ipLong & $maskLong) === ($netLong & $maskLong)) {
            return true;
        }
    }
    return false;
}

function client_ip()
{
    if (is_real_cloudflare_request() && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return (string)$_SERVER['HTTP_CF_CONNECTING_IP'];
    }
    return isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : 'x';
}

function rate_limit($bucket, $max, $window)
{
    $f = DATA_DIR . '/rl_' . md5($bucket . client_ip()) . '.json';
    $now = time();
    $st = read_json($f, ['t' => $now, 'n' => 0]);
    if ($now - (int)$st['t'] > $window) {
        $st = ['t' => $now, 'n' => 0];
    }
    $st['n'] = (int)$st['n'] + 1;
    write_json($f, $st);
    if ($st['n'] > $max) {
        fail('Too many requests', 429);
    }
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                         */
/* ------------------------------------------------------------------ */
function clean($s, $max = 500)
{
    $s = trim((string)$s);
    $c = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s);
    if ($c !== null) {
        $s = $c;
    }
    return mb_substr($s, 0, $max, 'UTF-8');
}

function norm_key($s)
{
    $s = mb_strtolower((string)$s, 'UTF-8');
    $s = str_replace(
        ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', 'ي', 'ك', 'ة', 'آ', 'أ', 'إ'],
        ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'ی', 'ک', 'ه', 'ا', 'ا', 'ا'],
        $s
    );
    $s = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}\x{00AD}]/u', '', $s);
    $s = preg_replace('/[^\p{L}\p{N}]/u', '', (string)$s);
    return (string)$s;
}

function norm_url($u)
{
    $u = strtolower(trim((string)$u));
    $u = preg_replace('#^https?://(www\.)?#', '', $u);
    return rtrim((string)$u, '/');
}

function is_http_url($u)
{
    return is_string($u) && preg_match('#^https?://#i', $u) === 1 && filter_var($u, FILTER_VALIDATE_URL) !== false;
}
/* ------------------------------------------------------------------ */
/* Safe remote fetch + image cache                                      */
/* ------------------------------------------------------------------ */
function is_public_http_url($url)
{
    $p = parse_url((string)$url);
    if (!$p || empty($p['host'])) {
        return false;
    }
    $scheme = strtolower(isset($p['scheme']) ? $p['scheme'] : '');
    if ($scheme !== 'http' && $scheme !== 'https') {
        return false;
    }
    if (isset($p['port']) && !in_array((int)$p['port'], [80, 443], true)) {
        return false;
    }
    $host = $p['host'];
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        $ips = [$host];
    } else {
        $ips = gethostbynamel($host);
        if (!$ips) {
            return false;
        }
    }
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }
    }
    return true;
}

function resolve_redirect($base, $loc)
{
    if (preg_match('#^https?://#i', $loc)) {
        return $loc;
    }
    $p = parse_url($base);
    if (!$p || empty($p['host'])) {
        return null;
    }
    $root = $p['scheme'] . '://' . $p['host'];
    if (strpos($loc, '/') === 0) {
        return $root . $loc;
    }
    return null;
}

function fetch_remote($url, $maxBytes = 5242880)
{
    for ($i = 0; $i < 4; $i++) {
        if (!is_public_http_url($url)) {
            return null;
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_MAXFILESIZE    => $maxBytes,
            CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        ]);
        $res  = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $hs   = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        if ($res === false) {
            return null;
        }
        $headers = substr($res, 0, $hs);
        $payload = substr($res, $hs);
        if ($code >= 300 && $code < 400 && preg_match('/^Location:\s*(\S+)/mi', $headers, $m)) {
            $next = resolve_redirect($url, $m[1]);
            if (!$next) {
                return null;
            }
            $url = $next;
            continue;
        }
        if ($code < 200 || $code >= 300 || strlen($payload) > $maxBytes) {
            return null;
        }
        return $payload;
    }
    return null;
}

function image_ext_from_data($data)
{
    $info = @getimagesizefromstring($data);
    if (!$info) {
        return null;
    }
    $map = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_GIF  => 'gif',
        IMAGETYPE_WEBP => 'webp',
    ];
    return isset($map[$info[2]]) ? $map[$info[2]] : null;
}

function cache_image($url)
{
    if (!is_http_url($url)) {
        return $url;
    }
    if (strpos($url, '/uploads/') !== false && strpos($url, 'nafisstore.com') !== false) {
        return $url;
    }
    $hash = md5($url);
    foreach (['jpg', 'png', 'gif', 'webp'] as $e) {
        if (is_file(UPLOADS_DIR . '/cached_' . $hash . '.' . $e)) {
            return SITE_ORIGIN . '/uploads/cached_' . $hash . '.' . $e;
        }
    }
    $dl = $url;
    if (strpos($dl, 'images.unsplash.com') !== false && strpos($dl, 'w=') === false) {
        $dl .= (strpos($dl, '?') !== false ? '&' : '?') . 'w=800&q=80&auto=format';
    }
    $data = fetch_remote($dl);
    if ($data === null || strlen($data) < 500) {
        return $url;
    }
    $ext = image_ext_from_data($data);
    if (!$ext) {
        return $url;
    }
    $name = 'cached_' . $hash . '.' . $ext;
    if (@file_put_contents(UPLOADS_DIR . '/' . $name, $data) === false) {
        return $url;
    }
    return SITE_ORIGIN . '/uploads/' . $name;
}

/* ------------------------------------------------------------------ */
/* Telegram                                                             */
/* ------------------------------------------------------------------ */
function tg_call($tgMethod, $payload)
{
    $token = secret('bot_token');
    if ($token === '') {
        return ['ok' => false, 'description' => 'bot_token is not configured'];
    }
    $base = secret('tg_api_base');
    if ($base === '') {
        $base = 'https://api.telegram.org';
    }
    $ch = curl_init(rtrim($base, '/') . '/bot' . $token . '/' . $tgMethod);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) {
        return ['ok' => false, 'description' => 'curl: ' . $err];
    }
    $d = json_decode($res, true);
    return is_array($d) ? $d : ['ok' => false, 'description' => 'bad response from telegram'];
}

function verify_init_data($initData)
{
    $token = secret('bot_token');
    if ($token === '' || !is_string($initData) || $initData === '') {
        return null;
    }
    parse_str($initData, $params);
    if (empty($params['hash'])) {
        return null;
    }
    $hash = $params['hash'];
    unset($params['hash']);
    ksort($params);
    $pairs = [];
    foreach ($params as $k => $v) {
        $pairs[] = $k . '=' . $v;
    }
    $secretKey = hash_hmac('sha256', $token, 'WebAppData', true);
    $calc = hash_hmac('sha256', implode("\n", $pairs), $secretKey);
    if (!hash_equals($calc, (string)$hash)) {
        return null;
    }
    if (empty($params['auth_date']) || time() - (int)$params['auth_date'] > 86400) {
        return null;
    }
    $user = json_decode(isset($params['user']) ? $params['user'] : '', true);
    return (is_array($user) && !empty($user['id'])) ? $user : null;
}

/* ------------------------------------------------------------------ */
/* Logistics & Weight-based Cargo Calculator (consolidated)             */
/* ------------------------------------------------------------------ */
function calculate_default_logistics($p, $rates)
{
    $weightKg = isset($p['weightKg']) && (float)$p['weightKg'] > 0 ? (float)$p['weightKg'] : 1.0;
    $routeType = isset($p['routeType']) ? $p['routeType'] : 'china_dubai_iran';
    $customsPerKg = isset($p['customsPerKg']) ? (float)$p['customsPerKg'] : 700000.0;

    $aedRate = (float)($rates['aed'] ?? DEFAULT_AED_RATE);
    $cnyRate = (float)($rates['cny'] ?? DEFAULT_CNY_RATE);

    $cargoToman = 0;
    if ($routeType === 'china_dubai_iran') {
        $cargoToman = $weightKg * 48.0 * $aedRate; // ۴۸ درهم هر کیلو
    } elseif ($routeType === 'china_iran_direct') {
        $cargoToman = $weightKg * 55.0 * $cnyRate; // ۵۵ یوان هر کیلو مستقیم
    } else {
        $cargoToman = $weightKg * 20.0 * $aedRate; // دبی به ایران ۲۰ درهم هر کیلو
    }

    $customsToman = $weightKg * $customsPerKg;
    return round($cargoToman + $customsToman);
}

/* ------------------------------------------------------------------ */
/* Catalog & Pricing helpers                                            */
/* ------------------------------------------------------------------ */
function fetch_live_rates(&$debug)
{
    $source = 'TGJU (direct)';
    $relayCode = 0;
    $relayErr = '';
    $res = fetch_remote('https://call.tgju.org/ajax.json', 2097152);
    $live = $res !== null ? json_decode($res, true) : null;
    if (!is_array($live) || !isset($live['current'])) {
        $source = 'TGJU (relay)';
        $relay = secret('relay_url');
        $rtoken = secret('relay_token');
        if ($relay === '' || $rtoken === '') {
            $debug = ['error' => 'Direct fetch failed and relay is not configured'];
            return null;
        }
        $ch = curl_init(rtrim($relay, '/') . '/?url=' . urlencode('https://call.tgju.org/ajax.json'));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER     => ['X-Relay-Token: ' . $rtoken],
        ]);
        $res = curl_exec($ch);
        $relayCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $relayErr = curl_error($ch);
        curl_close($ch);
        $live = json_decode((string)$res, true);
    }
    $cur = (is_array($live) && isset($live['current'])) ? $live['current'] : [];
    $num = function ($k) use ($cur) {
        return isset($cur[$k]['p']) ? (float)str_replace(',', '', $cur[$k]['p']) : 0;
    };
    $usd = $num('price_dollar_rl');
    $aed = $num('price_aed');
    $cny = $num('price_cny');
    if ($usd <= 0) {
        $debug = [
            'relay_http_code' => $relayCode,
            'curl_error' => $relayErr,
            'relay_response_start' => mb_substr(is_string($res) ? $res : '', 0, 200, 'UTF-8'),
        ];
        return null;
    }
    return [
        'usd' => (int)round($usd / 10),
        'aed' => $aed > 0 ? (int)round($aed / 10) : 0,
        'cny' => $cny > 0 ? (int)round($cny / 10) : 0,
        'isLive' => true,
        'source' => $source,
        'lastUpdated' => date('H:i:s'),
        'updatedAt' => time(),
    ];
}

function get_rates_data()
{
    global $RATES_FILE;
    $r = read_json($RATES_FILE, null);
    $hasRate = is_array($r) && !empty($r['usd']);
    $age = $hasRate ? (time() - (isset($r['updatedAt']) ? (int)$r['updatedAt'] : (int)@filemtime($RATES_FILE))) : PHP_INT_MAX;
    $manual = $hasRate && isset($r['source']) && $r['source'] === 'manual' && $age < 6 * 3600;
    if (!$manual && $age > 1800) {
        $stamp = DATA_DIR . '/rates.attempt';
        $lastTry = is_file($stamp) ? (int)@filemtime($stamp) : 0;
        if (time() - $lastTry > 300) {
            @touch($stamp);
            $debug = [];
            $fresh = fetch_live_rates($debug);
            if ($fresh) {
                write_json($RATES_FILE, $fresh);
                return $fresh;
            }
        }
    }
    if ($hasRate) {
        if ($age > 86400) {
            $r['isLive'] = false;
            $r['source'] = (isset($r['source']) ? $r['source'] : '') . ' (stale)';
        }
        return $r;
    }
    return ['usd' => DEFAULT_USD_RATE, 'aed' => DEFAULT_AED_RATE, 'cny' => DEFAULT_CNY_RATE, 'isLive' => false, 'source' => 'default (stale)', 'lastUpdated' => ''];
}

function build_tiers($baseUsd, $moq, $usdRate, $margin)
{
    $m1 = max(5, $margin);
    $m2 = max(5, round($margin * 0.8));
    $m3 = max(5, round($margin * 0.6));

    $rates = get_rates_data();
    // پیش‌فرض وزن ۱ کیلوگرم برای محاسبه پله‌ها
    $logisticsToman = calculate_default_logistics(['weightKg' => 1.0, 'routeType' => 'china_dubai_iran'], $rates);

    $calcToman = function ($usd, $m) use ($usdRate, $logisticsToman) {
        $rawT = $usd * $usdRate;
        return (int)(round(($rawT + $logisticsToman) * (1 + $m / 100) / 1000) * 1000);
    };

    return [
        [
            'minQuantity' => $moq,
            'maxQuantity' => $moq * 3 - 1,
            'priceUsd' => round($baseUsd * (1 + $m1 / 100), 2),
            'marginPercent' => $m1,
            'calculatedPriceToman' => $calcToman($baseUsd, $m1),
        ],
        [
            'minQuantity' => $moq * 3,
            'maxQuantity' => $moq * 10 - 1,
            'priceUsd' => round($baseUsd * (1 + $m2 / 100), 2),
            'marginPercent' => $m2,
            'calculatedPriceToman' => $calcToman($baseUsd, $m2),
        ],
        [
            'minQuantity' => $moq * 10,
            'priceUsd' => round($baseUsd * (1 + $m3 / 100), 2),
            'marginPercent' => $m3,
            'calculatedPriceToman' => $calcToman($baseUsd, $m3),
        ],
    ];
}

function str_list($arr, $maxItems, $maxLen)
{
    $o = [];
    foreach ((array)$arr as $v) {
        if (is_string($v) || is_numeric($v)) {
            $s = clean($v, $maxLen);
            if ($s !== '') {
                $o[] = $s;
            }
        }
        if (count($o) >= $maxItems) {
            break;
        }
    }
    return $o;
}
function build_product($in, $usdRate, $defaultMargin, $cacheImages)
{
    if (!is_array($in)) {
        return [null, 'invalid item'];
    }
    $faTitle = clean(isset($in['faTitle']) ? $in['faTitle'] : '', 300);
    $orig    = clean(isset($in['originalTitle']) ? $in['originalTitle'] : '', 400);
    $src     = isset($in['sourceUrl']) ? trim((string)$in['sourceUrl']) : '';
    $cost    = (float)(isset($in['costPerUnitUsd']) ? $in['costPerUnitUsd'] : (isset($in['baseUsd']) ? $in['baseUsd'] : 0));
    $moq     = (int)(isset($in['moq']) ? $in['moq'] : 1);

    if ($faTitle === '' || $orig === '') {
        return [null, 'missing title'];
    }
    if (!is_http_url($src)) {
        return [null, 'missing/invalid sourceUrl'];
    }
    if ($cost <= 0) {
        return [null, 'missing/invalid costPerUnitUsd'];
    }
    if ($moq < 1) {
        $moq = 1;
    }

    $images = [];
    if (!empty($in['mainImage']) && is_http_url($in['mainImage'])) {
        $images[] = $in['mainImage'];
    }
    foreach ((array)(isset($in['images']) ? $in['images'] : []) as $u) {
        if (is_http_url($u)) {
            $images[] = $u;
        }
    }
    $images = array_slice(array_values(array_unique($images)), 0, 6);
    if (!$images) {
        return [null, 'no valid image'];
    }
    if ($cacheImages) {
        $images = array_map('cache_image', array_slice($images, 0, 4));
    }

    $margin = (isset($in['targetMarginPercent']) && is_numeric($in['targetMarginPercent']))
        ? (float)$in['targetMarginPercent']
        : (isset($in['estimatedMarginPercent']) && is_numeric($in['estimatedMarginPercent']) ? (float)$in['estimatedMarginPercent'] : $defaultMargin);
    if ($margin < 0 || $margin > 300) {
        $margin = $defaultMargin;
    }

    $rates = get_rates_data();
    $costCny = (!empty($rates['cny'])) ? round($cost * $usdRate / (float)$rates['cny'], 1) : null;
    $costAed = (!empty($rates['aed'])) ? round($cost * $usdRate / (float)$rates['aed'], 1) : null;

    $sIn = isset($in['supplier']) && is_array($in['supplier']) ? $in['supplier'] : [];
    $supplier = [
        'name'               => clean(isset($sIn['name']) ? $sIn['name'] : '', 200),
        'platform'           => clean(isset($sIn['platform']) ? $sIn['platform'] : '', 50),
        'country'            => clean(isset($sIn['country']) ? $sIn['country'] : '', 60),
        'city'               => clean(isset($sIn['city']) ? $sIn['city'] : '', 60),
        'yearsInBusiness'    => (int)(isset($sIn['yearsInBusiness']) ? $sIn['yearsInBusiness'] : 0),
        'isVerified'         => !empty($sIn['isVerified']),
        'hasTradeAssurance'  => !empty($sIn['hasTradeAssurance']),
        'rating'             => (float)(isset($sIn['rating']) ? $sIn['rating'] : 0),
        'responseRate'       => clean(isset($sIn['responseRate']) ? $sIn['responseRate'] : '', 20),
        'onTimeDeliveryRate' => clean(isset($sIn['onTimeDeliveryRate']) ? $sIn['onTimeDeliveryRate'] : '', 20),
        'reviewCount'        => (int)(isset($sIn['reviewCount']) ? $sIn['reviewCount'] : 0),
        'trustScore'         => (int)(isset($sIn['trustScore']) ? $sIn['trustScore'] : 0),
    ];
    if (!empty($sIn['supplierProfileUrl']) && is_http_url($sIn['supplierProfileUrl'])) {
        $supplier['supplierProfileUrl'] = $sIn['supplierProfileUrl'];
    }

    $specs = [];
    foreach ((array)(isset($in['technicalSpecs']) ? $in['technicalSpecs'] : []) as $k => $v) {
        if ((is_string($v) || is_numeric($v)) && count($specs) < 30) {
            $specs[clean($k, 80)] = clean($v, 200);
        }
    }

    $tiers = [];
    if (!empty($in['tieredPricing']) && is_array($in['tieredPricing'])) {
        foreach ($in['tieredPricing'] as $t) {
            if (is_array($t) && !empty($t['minQuantity']) && !empty($t['calculatedPriceToman'])) {
                $row = [
                    'minQuantity' => (int)$t['minQuantity'],
                    'priceUsd' => (float)(isset($t['priceUsd']) ? $t['priceUsd'] : 0),
                    'marginPercent' => (float)(isset($t['marginPercent']) ? $t['marginPercent'] : $margin),
                    'calculatedPriceToman' => (int)$t['calculatedPriceToman'],
                ];
                if (!empty($t['maxQuantity'])) {
                    $row['maxQuantity'] = (int)$t['maxQuantity'];
                }
                $tiers[] = $row;
            }
        }
    }
    if (!$tiers) {
        $tiers = build_tiers($cost, $moq, $usdRate, $margin);
    }

    $score = isset($in['trendScore']) ? (int)$in['trendScore'] : 85;
    $score = max(0, min(100, $score));

    $product = [
        'id'                     => 'HUNT-' . time() . '-' . mt_rand(1000, 9999),
        'externalId'             => clean(isset($in['externalId']) ? $in['externalId'] : '', 100),
        'createdAt'              => date('Y-m-d'),
        'sourceUrl'              => $src,
        'originalTitle'          => $orig,
        'faTitle'                => $faTitle,
        'faShortDesc'            => clean(isset($in['faShortDesc']) ? $in['faShortDesc'] : '', 600),
        'faFullDesc'             => clean(isset($in['faFullDesc']) ? $in['faFullDesc'] : '', 6000),
        'faFeatures'             => str_list(isset($in['faFeatures']) ? $in['faFeatures'] : [], 12, 300),
        'technicalSpecs'         => $specs,
        'category'               => clean(isset($in['category']) && $in['category'] !== '' ? $in['category'] : 'عمومی', 100),
        'tags'                   => str_list(isset($in['tags']) ? $in['tags'] : [], 12, 60),
        'mainImage'              => $images[0],
        'images'                 => $images,
        'costPerUnitUsd'         => round($cost, 2),
        'costPerUnitCny'         => $costCny,
        'costPerUnitAed'         => $costAed,
        'targetMarginPercent'    => $margin,
        'estimatedMarginPercent' => $margin,
        'customsTariffPercent'   => isset($in['customsTariffPercent']) ? (float)$in['customsTariffPercent'] : 6.0,
        'leadTimeDays'           => (int)(isset($in['leadTimeDays']) ? $in['leadTimeDays'] : 7),
        'moq'                    => $moq,
        'trendScore'             => $score,
        'weightKg'               => isset($in['weightKg']) ? (float)$in['weightKg'] : 1.0,
        'routeType'              => isset($in['routeType']) ? $in['routeType'] : 'china_dubai_iran',
        'customsPerKg'           => isset($in['customsPerKg']) ? (float)$in['customsPerKg'] : 700000.0,
        'tieredPricing'          => $tiers,
        'supplier'               => $supplier,
        'isSyncedToSheets'       => false,
        'isPostedToTelegram'     => false,
    ];
    return [$product, null];
}


/* ------------------------------------------------------------------ */
/* انتشار خودکار محصول جدید در کانال تلگرام                            */
/* ------------------------------------------------------------------ */
function channel_auto_enabled()
{
    global $SETTINGS_FILE;
    $st = read_json($SETTINGS_FILE, []);
    return !isset($st['autoChannelPost']) || !empty($st['autoChannelPost']);
}

function channel_chat_id()
{
    global $SETTINGS_FILE;
    $st = read_json($SETTINGS_FILE, []);
    $chat = secret('channel_id') !== '' ? trim(secret('channel_id')) : (isset($st['channelId']) ? trim((string)$st['channelId']) : '@NafisSmartTrade');
    if ($chat !== '' && $chat[0] !== '@' && !preg_match('/^-?\d+$/', $chat)) {
        $chat = '@' . $chat;
    }
    return $chat;
}

function channel_product_caption($p)
{
    $lines = ['🆕 ' . trim((string)($p['faTitle'] ?? 'محصول جدید')), ''];
    $feats = isset($p['faFeatures']) && is_array($p['faFeatures']) ? array_slice($p['faFeatures'], 0, 3) : [];
    foreach ($feats as $f) {
        $f = trim((string)$f);
        if ($f !== '') {
            $lines[] = '• ' . mb_substr($f, 0, 110, 'UTF-8');
        }
    }
    if ($feats) {
        $lines[] = '';
    }
    if (!empty($p['moq']) && is_numeric($p['moq'])) {
        $lines[] = '📦 حداقل سفارش: ' . (int)$p['moq'] . ' عدد';
    }
    $lines[] = '💰 قیمت عمده، مشخصات کامل و ثبت استعلام در مینی‌اپ 👇';
    return mb_substr(implode("\n", $lines), 0, 1000, 'UTF-8');
}

function channel_product_link($p)
{
    global $SETTINGS_FILE;
    $st = read_json($SETTINGS_FILE, []);
    $base = isset($st['miniAppUrl']) ? trim((string)$st['miniAppUrl']) : '';
    if ($base === '' || strpos($base, 'https://') !== 0 || strpos($base, 'ais-dev-') !== false) {
        $base = SITE_ORIGIN;
    }
    $base = rtrim($base, '/');
    return $base . (strpos($base, '?') !== false ? '&' : '?') . 'view=miniapp&productId=' . rawurlencode((string)($p['id'] ?? ''));
}

/* یک محصول را در کانال منتشر می‌کند. خروجی: [ok(bool), error(string)] */
function channel_announce($p)
{
    if (!is_array($p) || empty($p['id'])) {
        return [false, 'invalid product'];
    }
    if (secret('bot_token') === '') {
        return [false, 'bot_token is not configured'];
    }
    $chat = channel_chat_id();
    $caption = channel_product_caption($p);
    $markup = ['inline_keyboard' => [[['text' => '🛒 مشاهده جزئیات و استعلام در مینی‌اپ', 'url' => channel_product_link($p)]]]];
    $photo = !empty($p['mainImage']) ? trim((string)$p['mainImage']) : '';
    $ok = false;
    $err = '';
    if ($photo !== '' && is_http_url($photo)) {
        $r = tg_call('sendPhoto', ['chat_id' => $chat, 'photo' => cache_image($photo), 'caption' => $caption, 'reply_markup' => $markup]);
        $ok = !empty($r['ok']);
        $err = $ok ? '' : (isset($r['description']) ? $r['description'] : 'sendPhoto failed');
    }
    if (!$ok) {
        $r = tg_call('sendMessage', ['chat_id' => $chat, 'text' => $caption, 'reply_markup' => $markup]);
        $ok = !empty($r['ok']);
        $err = $ok ? '' : (isset($r['description']) ? $r['description'] : ($err ?: 'sendMessage failed'));
    }
    if ($ok) {
        global $CATALOG_FILE;
        $id = $p['id'];
        with_lock('catalog', function () use ($CATALOG_FILE, $id) {
            $items = read_json($CATALOG_FILE, []);
            foreach ($items as &$it) {
                if (isset($it['id']) && $it['id'] === $id) {
                    $it['isPostedToTelegram'] = true;
                    $it['channelPostedAt'] = date('c');
                    break;
                }
            }
            unset($it);
            write_json($CATALOG_FILE, $items);
        });
    }
    return [$ok, $err];
}

/* چند محصول را پشت‌سرهم (حداکثر $max) منتشر می‌کند؛ هرگز باعث خطای درخواست اصلی نمی‌شود. */
function channel_announce_many($products, $max = 5)
{
    $posted = 0;
    $errors = [];
    try {
        if (!channel_auto_enabled()) {
            return ['posted' => 0, 'errors' => []];
        }
        foreach (array_slice(array_values((array)$products), 0, $max) as $i => $p) {
            if (!empty($p['isPostedToTelegram'])) {
                continue;
            }
            if ($i > 0) {
                sleep(1);
            }
            list($ok, $err) = channel_announce($p);
            if ($ok) {
                $posted++;
            } else {
                $errors[] = $err;
            }
        }
    } catch (\Throwable $e) {
        $errors[] = $e->getMessage();
    }
    return ['posted' => $posted, 'errors' => $errors];
}

/* ================================================================== */
/* ROUTER                                                              */
/* ================================================================== */

if ($action === 'health') {
    out(['ok' => true, 'api_version' => API_VERSION, 'timestamp' => date('c')]);
}

if ($action === 'get_public_config') {
    $st = read_json($SETTINGS_FILE, []);
    $cfg = [
        'channelId'     => isset($st['channelId']) ? $st['channelId'] : '@NafisSmartTrade',
        'miniAppUrl'    => isset($st['miniAppUrl']) ? $st['miniAppUrl'] : SITE_ORIGIN,
        'adminUsername' => isset($st['adminUsername']) ? $st['adminUsername'] : '',
    ];
    out(['success' => true, 'config' => $cfg, 'settings' => $cfg]);
}

if (!function_exists('public_product')) {
    function public_product($p, $liveUsd)
    {
        // نسخه عمومی محصول بدون داده‌های حساس — در صورت وجود تابع مشابه در کد اصلی شما، همان حفظ شود
        if (!is_array($p)) {
            return $p;
        }
        $pub = $p;
        foreach (['costPerUnitUsd', 'costPerUnitCny', 'costPerUnitAed', 'customsTariffPercent', 'targetMarginPercent', 'estimatedMarginPercent'] as $k) {
            unset($pub[$k]);
        }
        if (isset($pub['supplier']) && is_array($pub['supplier'])) {
            unset($pub['supplier']['supplierProfileUrl']);
        }
        return $pub;
    }
}

if ($action === 'get_products') {
    $items = read_json($CATALOG_FILE, []);
    if (!is_array($items)) {
        $items = [];
    }
    $liveUsd = (float)get_rates_data()['usd'];
    out(['success' => true, 'products' => array_map(function ($p) use ($liveUsd) {
        return public_product($p, $liveUsd);
    }, $items)]);
}

if ($action === 'get_rates') {
    out(get_rates_data());
}

if ($action === 'image_proxy') {
    rate_limit('imgproxy', 240, 3600);
    $url = isset($_GET['url']) ? (string)$_GET['url'] : '';
    if (!is_http_url($url)) {
        fail('Invalid image url', 400);
    }
    // FIXED: whitelist دامنه‌ها برای جلوگیری از abuse
    $allowedHosts = ['nafisstore.com', 'images.unsplash.com', 'alibaba.com', '1688.com', 'made-in-china.com', 'aliexpress.com'];
    $host = strtolower((string)parse_url($url, PHP_URL_HOST));
    $hostOk = false;
    foreach ($allowedHosts as $ah) {
        if ($host === $ah || substr($host, -strlen($ah) - 1) === '.' . $ah) {
            $hostOk = true;
            break;
        }
    }
    if (!$hostOk) {
        fail('Image host not allowed', 403);
    }
    $cached = cache_image($url);
    $path = null;
    if (strpos($cached, SITE_ORIGIN . '/uploads/') === 0) {
        $path = UPLOADS_DIR . '/' . basename($cached);
    }
    if ($path && is_file($path)) {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $types = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp'];
        header('Content-Type: ' . (isset($types[$ext]) ? $types[$ext] : 'application/octet-stream'));
        header('Cache-Control: public, max-age=2592000');
        readfile($path);
        exit;
    }
    fail('Image not available', 404);
}
/* ---------------- Customer endpoints ---------------- */
if ($action === 'submit_inquiry' && $method === 'POST') {
    rate_limit('inquiry', 10, 3600);
    $user = verify_init_data(isset($body['initData']) ? $body['initData'] : '');
    if (!$user) {
        fail('Telegram authentication failed', 401);
    }
    $message = clean(isset($body['message']) ? $body['message'] : '', 1500);
    $productTitle = clean(isset($body['productTitle']) ? $body['productTitle'] : '', 300);
    if ($message === '' && $productTitle === '') {
        fail('Empty inquiry', 422);
    }
    $inq = [
        'id'             => 'INQ-' . time() . '-' . mt_rand(1000, 9999),
        'createdAt'      => date('c'),
        'status'         => 'new',
        'telegramUserId' => (int)$user['id'],
        'customerName'   => clean(trim((isset($user['first_name']) ? $user['first_name'] : '') . ' ' . (isset($user['last_name']) ? $user['last_name'] : '')), 120),
        'username'       => clean(isset($user['username']) ? $user['username'] : '', 60),
        'phone'          => clean(isset($body['phone']) ? $body['phone'] : '', 30),
        'productId'      => clean(isset($body['productId']) ? $body['productId'] : '', 100),
        'productTitle'   => $productTitle,
        'quantity'       => (int)(isset($body['quantity']) ? $body['quantity'] : 0),
        'message'        => $message,
        'replies'        => [],
    ];
    with_lock('crm', function () use ($CRM_FILE, $inq) {
        $crm = read_json($CRM_FILE, ['customers' => [], 'inquiries' => []]);
        if (!isset($crm['inquiries']) || !is_array($crm['inquiries'])) {
            $crm['inquiries'] = [];
        }
        if (!isset($crm['customers']) || !is_array($crm['customers'])) {
            $crm['customers'] = [];
        }
        $found = false;
        foreach ($crm['customers'] as &$c) {
            if (isset($c['telegramUserId']) && (int)$c['telegramUserId'] === $inq['telegramUserId']) {
                $found = true;
                if ($inq['phone'] !== '') {
                    $c['phone'] = $inq['phone'];
                }
                break;
            }
        }
        unset($c);
        if (!$found) {
            $crm['customers'][] = [
                'telegramUserId' => $inq['telegramUserId'],
                'name'           => $inq['customerName'],
                'username'       => $inq['username'],
                'phone'          => $inq['phone'],
                'createdAt'      => date('c'),
            ];
        }
        array_unshift($crm['inquiries'], $inq);
        write_json($CRM_FILE, $crm);
    });
    $adminChat = secret('admin_chat_id');
    if ($adminChat !== '') {
        $txt = "📩 استعلام جدید " . $inq['id'] . "\n"
             . "مشتری: " . $inq['customerName'] . ($inq['username'] ? ' (@' . $inq['username'] . ')' : '') . "\n"
             . "محصول: " . $inq['productTitle'] . "\n"
             . "تعداد: " . $inq['quantity'] . "\n"
             . ($inq['message'] !== '' ? "پیام: " . $inq['message'] : '');
        tg_call('sendMessage', ['chat_id' => $adminChat, 'text' => $txt]);
    }
    out(['success' => true, 'id' => $inq['id']]);
}

if ($action === 'my_inquiries' && $method === 'POST') {
    rate_limit('myinq', 120, 3600);
    $user = verify_init_data(isset($body['initData']) ? $body['initData'] : '');
    if (!$user) {
        fail('Telegram authentication failed', 401);
    }
    $crm = read_json($CRM_FILE, ['customers' => [], 'inquiries' => []]);
    $mine = [];
    foreach ((array)(isset($crm['inquiries']) ? $crm['inquiries'] : []) as $q) {
        if (isset($q['telegramUserId']) && (int)$q['telegramUserId'] === (int)$user['id']) {
            $mine[] = $q;
        }
    }
    out(['success' => true, 'inquiries' => $mine]);
}

/* ---------------- Ingest ---------------- */
if ($action === 'ingest_products' && $method === 'POST') {
    require_ingest();
    @set_time_limit(120);
    $items = isset($body['products']) && is_array($body['products']) ? $body['products'] : [];
    if (!$items) {
        fail('products[] is required', 422);
    }
    $items = array_slice($items, 0, 20);
    $cacheImages = !isset($body['cacheImages']) || !empty($body['cacheImages']);
    $rates = get_rates_data();
    $usd = (float)$rates['usd'];
    $st = read_json($SETTINGS_FILE, []);
    $defaultMargin = isset($st['targetMarginPercent']) ? (float)$st['targetMarginPercent'] : 25.0;

    $result = with_lock('catalog', function () use ($CATALOG_FILE, $items, $usd, $defaultMargin, $cacheImages) {
        $existing = read_json($CATALOG_FILE, []);
        if (!is_array($existing)) {
            $existing = [];
        }
        $keys = [];
        foreach ($existing as $p) {
            foreach (['faTitle', 'originalTitle'] as $f) {
                if (!empty($p[$f])) {
                    $keys['t:' . norm_key($p[$f])] = true;
                }
            }
            if (!empty($p['sourceUrl'])) {
                $keys['u:' . norm_url($p['sourceUrl'])] = true;
            }
            if (!empty($p['externalId'])) {
                $keys['e:' . $p['externalId']] = true;
            }
        }
        $added = [];
        $skipped = [];
        foreach ($items as $idx => $in) {
            list($p, $err) = build_product($in, $usd, $defaultMargin, $cacheImages);
            if (!$p) {
                $skipped[] = ['index' => $idx, 'reason' => $err];
                continue;
            }
            $dupReason = null;
            if (isset($keys['t:' . norm_key($p['faTitle'])]) || isset($keys['t:' . norm_key($p['originalTitle'])])) {
                $dupReason = 'duplicate title';
            } elseif (isset($keys['u:' . norm_url($p['sourceUrl'])])) {
                $dupReason = 'duplicate sourceUrl';
            } elseif ($p['externalId'] !== '' && isset($keys['e:' . $p['externalId']])) {
                $dupReason = 'duplicate externalId';
            }
            if ($dupReason) {
                $skipped[] = ['index' => $idx, 'reason' => $dupReason];
                continue;
            }
            $keys['t:' . norm_key($p['faTitle'])] = true;
            $keys['t:' . norm_key($p['originalTitle'])] = true;
            $keys['u:' . norm_url($p['sourceUrl'])] = true;
            if ($p['externalId'] !== '') {
                $keys['e:' . $p['externalId']] = true;
            }
            $added[] = $p;
        }
        if ($added) {
            $merged = array_slice(array_merge($added, $existing), 0, 5000);
            if (is_file($CATALOG_FILE)) {
                @copy($CATALOG_FILE, DATA_DIR . '/catalog.bak.json');
            }
            write_json($CATALOG_FILE, $merged);
        }
        return ['added' => $added, 'skipped' => $skipped];
    });
    $chanRes = channel_announce_many($result['added']);
    out([
        'success' => true,
        'channel_posted' => $chanRes['posted'],
        'channel_errors' => $chanRes['errors'],
        'added_count' => count($result['added']),
        'skipped' => $result['skipped'],
        'added_ids' => array_map(function ($p) {
            return $p['id'];
        }, $result['added']),
    ]);
}

if ($action === 'ingest_known') {
    require_ingest();
    $items = read_json($CATALOG_FILE, []);
    $ext = [];
    $urls = [];
    foreach ((array)$items as $p) {
        if (!empty($p['externalId'])) {
            $ext[] = $p['externalId'];
        }
        if (!empty($p['sourceUrl'])) {
            $urls[] = norm_url($p['sourceUrl']);
        }
    }
    out(['success' => true, 'externalIds' => $ext, 'sourceUrls' => $urls, 'count' => count((array)$items)]);
}

/* ---------------- Queue ---------------- */
function queue_load()
{
    global $QUEUE_FILE;
    $q = read_json($QUEUE_FILE, []);
    if (!is_array($q)) {
        $q = [];
    }
    $q['ideas'] = isset($q['ideas']) && is_array($q['ideas']) ? $q['ideas'] : [];
    $q['raw'] = isset($q['raw']) && is_array($q['raw']) ? $q['raw'] : [];
    return $q;
}

function queue_save($q)
{
    global $QUEUE_FILE;
    $cut = time() - 30 * 86400;
    $q['ideas'] = array_values(array_filter($q['ideas'], function ($i) use ($cut) {
        return ($i['status'] ?? 'pending') === 'pending' || ($i['ts'] ?? 0) > $cut;
    }));
    $q['raw'] = array_values(array_filter($q['raw'], function ($r) use ($cut) {
        return ($r['status'] ?? 'pending') === 'pending' || ($r['ts'] ?? 0) > $cut;
    }));
    $q['ideas'] = array_slice($q['ideas'], -500);
    $q['raw'] = array_slice($q['raw'], -300);
    return write_json($QUEUE_FILE, $q);
}

function external_id_from_url($url)
{
    if (preg_match('~alibaba\.com/product-detail/[^?#]*?_(\d{6,})\.html~i', $url, $m)) {
        return 'alibaba:' . $m[1];
    }
    if (preg_match('~1688\.com/offer/(\d{6,})\.html~i', $url, $m)) {
        return '1688:' . $m[1];
    }
    if (preg_match('~made-in-china\.com/product/([A-Za-z0-9]{6,})/~i', $url, $m)) {
        return 'mic:' . $m[1];
    }
    return '';
}

if ($action === 'queue_add_ideas' && $method === 'POST') {
    require_ingest();
    $in = isset($body['ideas']) && is_array($body['ideas']) ? array_slice($body['ideas'], 0, 30) : [];
    $res = with_lock('queue', function () use ($in) {
        $q = queue_load();
        $have = [];
        foreach ($q['ideas'] as $idx => $i) {
            $have[norm_key($i['keyword'] ?? '')] = $idx;
        }
        $added = 0;
        foreach ($in as $it) {
            $kw = clean(is_array($it) ? ($it['keyword'] ?? '') : $it, 120);
            $kwZh = clean(is_array($it) ? ($it['keywordZh'] ?? '') : '', 120);
            $note = clean(is_array($it) ? ($it['note'] ?? '') : '', 200);
            $nk = norm_key($kw !== '' ? $kw : $kwZh);
            if ($nk === '') {
                continue;
            }
            if (isset($have[$nk])) {
                $existingIdx = $have[$nk];
                if (($q['ideas'][$existingIdx]['status'] ?? '') !== 'pending') {
                    $q['ideas'][$existingIdx]['status'] = 'pending';
                    if ($kwZh !== '') {
                        $q['ideas'][$existingIdx]['keywordZh'] = $kwZh;
                    }
                    $q['ideas'][$existingIdx]['ts'] = time();
                    $added++;
                }
                continue;
            }
            $have[$nk] = count($q['ideas']);
            $q['ideas'][] = [
                'id' => bin2hex(random_bytes(6)),
                'keyword' => $kw !== '' ? $kw : $kwZh,
                'note' => $note,
                'keywordZh' => $kwZh,
                'status' => 'pending',
                'ts' => time(),
            ];
            $added++;
        }
        queue_save($q);
        return $added;
    });
    out(['success' => true, 'added' => $res]);
}

/* ------------------------------------------------------------------ */
/* ایجنت رصد: اجرای workflow گیت‌هاب (hunt.py در حالت search)          */
/* کلیدهای Gemini و ScraperAPI روی گیت‌هاب هستند؛ هاست فقط اجرا را فعال می‌کند */
/* ------------------------------------------------------------------ */
if ($action === 'sourcing_hunt' && $method === 'POST') {
    require_admin();
    $repo = trim(secret('github_repo'));
    $token = trim(secret('github_token'));
    if ($repo === '' || $token === '') {
        fail('github_repo و github_token در nfs-secrets.php تنظیم نشده‌اند', 503);
    }
    if (!preg_match('~^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$~', $repo)) {
        fail('فرمت github_repo نادرست است (مثال: owner/repo)', 503);
    }
    $dry = !isset($body['dry_run']) || (bool)$body['dry_run'];
    $limit = max(1, min(5, (int)($body['limit'] ?? 3)));
    $ref = secret('github_ref') ?: 'main';
    $base = secret('github_base') ?: 'https://api.github.com';
    $payload = json_encode([
        'ref' => $ref,
        'inputs' => ['mode' => 'search', 'dry_run' => $dry ? 'true' : 'false', 'limit' => (string)$limit],
    ]);
    $ch = curl_init($base . '/repos/' . $repo . '/actions/workflows/daily-hunt.yml/dispatches');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Accept: application/vnd.github+json',
            'Authorization: Bearer ' . $token,
            'X-GitHub-Api-Version: 2022-11-28',
            'Content-Type: application/json',
            'User-Agent: nfs-panel',
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);
    if ($raw === false) {
        fail('خطای شبکه هنگام تماس با GitHub: ' . $curlErr, 502);
    }
    if ($code !== 204) {
        fail('GitHub HTTP ' . $code . ': ' . substr((string)$raw, 0, 200), 502);
    }
    out([
        'success' => true,
        'dispatched' => true,
        'dryRun' => $dry,
        'limit' => $limit,
        'runsUrl' => 'https://github.com/' . $repo . '/actions/workflows/daily-hunt.yml',
    ]);
}

if ($action === 'queue_next_ideas') {
    require_ingest();
    $n = max(1, min(10, (int)($_GET['limit'] ?? 3)));
    $q = queue_load();
    $list = [];
    foreach ($q['ideas'] as $i) {
        if (($i['status'] ?? '') === 'pending') {
            $list[] = ['id' => $i['id'], 'keyword' => $i['keyword'], 'keywordZh' => $i['keywordZh'] ?? ''];
            if (count($list) >= $n) {
                break;
            }
        }
    }
    out(['success' => true, 'ideas' => $list]);
}

if ($action === 'queue_mark_idea' && $method === 'POST') {
    require_ingest();
    $id = clean($body['id'] ?? '', 40);
    if ($id === '') {
        fail('id is required', 422); // FIXED: اعتبارسنجی ورودی خالی
    }
    $status = ($body['status'] ?? '') === 'failed' ? 'failed' : 'done';
    $found = with_lock('queue', function () use ($id, $status) {
        $q = queue_load();
        $found = false;
        foreach ($q['ideas'] as &$i) {
            if (($i['id'] ?? '') === $id) {
                $i['status'] = $status;
                $i['ts'] = time();
                $found = true;
            }
        }
        unset($i);
        queue_save($q);
        return $found;
    });
    if (!$found) {
        fail('Idea not found', 404); // FIXED: بازگرداندن خطای واقعی به جای success بی‌صدا
    }
    out(['success' => true]);
}
if ($action === 'queue_submit_raw' && $method === 'POST') {
    require_ingest();
    $url = clean($body['sourceUrl'] ?? '', 800);
    if (!is_http_url($url)) {
        fail('sourceUrl is invalid', 422);
    }
    $host = strtolower((string)parse_url($url, PHP_URL_HOST));
    if (!preg_match('~(^|\.)(alibaba|1688|made-in-china)\.com$~', $host)) {
        fail('Only alibaba.com / 1688.com / made-in-china.com sources are accepted', 422);
    }
    $ext = external_id_from_url($url);
    if ($ext === '') {
        fail('URL is not a single product page', 422);
    }
    $title = clean($body['title'] ?? '', 400);
    $imgs = [];
    foreach ((array)($body['images'] ?? []) as $im) {
        if (is_string($im) && is_http_url($im) && count($imgs) < 12) {
            $imgs[] = clean($im, 800);
        }
    }
    if ($title === '' || !$imgs) {
        fail('title and images are required', 422);
    }
    $attrs = [];
    foreach (array_slice((array)($body['attributes'] ?? []), 0, 80) as $a) {
        if (is_array($a) && isset($a['key'], $a['value'])) {
            $attrs[] = ['key' => clean($a['key'], 120), 'value' => clean($a['value'], 300)];
        }
    }
    $raw = [
        'id' => bin2hex(random_bytes(6)),
        'externalId' => $ext,
        'sourceUrl' => $url,
        'title' => $title,
        'description' => clean($body['description'] ?? '', 3000),
        'priceRange' => clean($body['priceRange'] ?? '', 300),
        'moq' => clean($body['moq'] ?? '', 100),
        'images' => $imgs,
        'attributes' => $attrs,
        'fullText' => clean($body['full_description_text'] ?? '', 12000),
        'ideaId' => clean($body['ideaId'] ?? '', 40),
        'status' => 'pending',
        'ts' => time(),
    ];
    $res = with_lock('queue', function () use ($raw, $CATALOG_FILE) {
        $q = queue_load();
        foreach ($q['raw'] as $r) {
            if (($r['externalId'] ?? '') === $raw['externalId'] && ($r['status'] ?? '') !== 'failed') {
                return 'duplicate in queue';
            }
        }
        foreach ((array)read_json($CATALOG_FILE, []) as $p) {
            if (($p['externalId'] ?? '') === $raw['externalId']) {
                return 'duplicate in catalog';
            }
        }
        $q['raw'][] = $raw;
        queue_save($q);
        return '';
    });
    if ($res !== '') {
        out(['success' => true, 'queued' => false, 'reason' => $res]);
    }
    out(['success' => true, 'queued' => true, 'id' => $raw['id']]);
}

if ($action === 'queue_list') {
    require_ingest();
    $q = queue_load();
    $raw = [];
    foreach (array_reverse($q['raw']) as $r) {
        $raw[] = [
            'id' => $r['id'] ?? '',
            'externalId' => $r['externalId'] ?? '',
            'title' => $r['title'] ?? '',
            'priceRange' => $r['priceRange'] ?? '',
            'moq' => $r['moq'] ?? '',
            'description' => $r['description'] ?? '',
            'attributes' => $r['attributes'] ?? [],
            'fullText' => $r['fullText'] ?? '',
            'sourceUrl' => $r['sourceUrl'] ?? '',
            'status' => $r['status'] ?? 'pending',
            'ts' => $r['ts'] ?? 0,
            'reason' => $r['reason'] ?? ($r['error'] ?? ''),
        ];
        if (count($raw) >= 150) {
            break;
        }
    }
    $ideas = [];
    foreach (array_reverse($q['ideas']) as $i) {
        $ideas[] = [
            'id' => $i['id'] ?? '',
            'keyword' => $i['keyword'] ?? '',
            'keywordZh' => $i['keywordZh'] ?? '',
            'status' => $i['status'] ?? 'pending',
            'ts' => $i['ts'] ?? 0,
        ];
        if (count($ideas) >= 60) {
            break;
        }
    }
    out(['success' => true, 'raw' => $raw, 'ideas' => $ideas]);
}

if ($action === 'queue_get_raw') {
    require_ingest();
    $n = max(1, min(20, (int)($_GET['limit'] ?? 5)));
    $pfx = preg_replace('/[^a-z0-9]/', '', strtolower((string)($_GET['prefix'] ?? '')));
    $q = queue_load();
    $list = [];
    foreach ($q['raw'] as $r) {
        if ($pfx !== '' && strpos((string)($r['externalId'] ?? ''), $pfx . ':') !== 0) {
            continue;
        }
        if (($r['status'] ?? '') === 'pending') {
            $list[] = $r;
            if (count($list) >= $n) {
                break;
            }
        }
    }
    out(['success' => true, 'items' => $list, 'pending_total' => count(array_filter($q['raw'], function ($r) {
        return ($r['status'] ?? '') === 'pending';
    }))]);
}

if ($action === 'queue_resolve_raw' && $method === 'POST') {
    require_ingest();
    $ids = array_map(function ($x) {
        return clean($x, 40);
    }, array_slice((array)($body['ids'] ?? []), 0, 50));
    $status = ($body['status'] ?? '') === 'failed' ? 'failed' : 'done';
    $reason = clean($body['reason'] ?? '', 200);
    with_lock('queue', function () use ($ids, $status, $reason) {
        $q = queue_load();
        foreach ($q['raw'] as &$r) {
            if (in_array($r['id'] ?? '', $ids, true)) {
                $r['status'] = $status;
                $r['reason'] = $reason;
                $r['ts'] = time();
                if ($status === 'done') {
                    $r['fullText'] = '';
                    $r['attributes'] = [];
                }
            }
        }
        unset($r);
        queue_save($q);
    });
    out(['success' => true]);
}

/* ---------------- Manual Ingest from Agent ---------------- */
if ($action === 'ingest_manual_product' && $method === 'POST') {
    require_ingest();
    @set_time_limit(120);

    $rawId = clean($body['raw_id'] ?? '', 40);
    $gemini = isset($body['gemini_json']) && is_array($body['gemini_json']) ? $body['gemini_json'] : null;

    if ($rawId === '' || !is_array($gemini)) {
        fail('raw_id و gemini_json الزامی هستند', 422);
    }

    $q = queue_load();
    $rawItem = null;
    foreach ($q['raw'] as $r) {
        if (($r['id'] ?? '') === $rawId) {
            $rawItem = $r;
            break;
        }
    }
    if (!$rawItem) {
        fail('آیتم خام در صف پیدا نشد', 404);
    }

    if (isset($gemini['usable']) && $gemini['usable'] === false) {
        $reason = clean($gemini['rejectReason'] ?? 'رد شده توسط هوش مصنوعی (غیرقابل استفاده)', 200);
        with_lock('queue', function () use ($rawId, $reason) {
            $q2 = queue_load();
            foreach ($q2['raw'] as &$r) {
                if (($r['id'] ?? '') === $rawId) {
                    $r['status'] = 'failed';
                    $r['reason'] = $reason;
                    $r['ts'] = time();
                    break;
                }
            }
            unset($r);
            queue_save($q2);
        });
        fail('محصول توسط هوش مصنوعی رد شد: ' . $reason, 422);
    }

    $sourceUrl = $rawItem['sourceUrl'] ?? '';
    $images = isset($rawItem['images']) && is_array($rawItem['images']) ? $rawItem['images'] : [];
    // تصویر اصلی: اولویت با لینک ورودی پنل، سپس تصویر ذخیره‌شده خام
    $mainImgIn = isset($body['main_image']) ? trim((string)$body['main_image']) : '';
    if ($mainImgIn !== '' && is_http_url($mainImgIn)) {
        array_unshift($images, $mainImgIn);
    }
    $images = array_values(array_filter($images, 'is_http_url'));
    if (!$images) {
        fail('تصویر کالا لازم است: لینک تصویر اصلی را در پنل وارد کنید', 422);
    }

    $rates = get_rates_data();
    $usdRate = (float)($rates['usd'] ?? DEFAULT_USD_RATE);
    if ($usdRate <= 0) {
        $usdRate = DEFAULT_USD_RATE;
    }
    $cnyRate = !empty($rates['cny']) ? (float)$rates['cny'] : ($usdRate / 7.2);

    $st = read_json($SETTINGS_FILE, []);
    $defaultMargin = isset($st['targetMarginPercent']) ? (float)$st['targetMarginPercent'] : 25.0;
    $margin = (isset($gemini['targetMarginPercent']) && is_numeric($gemini['targetMarginPercent']))
        ? (float)$gemini['targetMarginPercent']
        : ((isset($body['margin_percent']) && is_numeric($body['margin_percent'])) ? (float)$body['margin_percent'] : $defaultMargin);

    $currency = strtoupper(trim((string)($gemini['currency'] ?? 'CNY')));
    $rawTiers = isset($gemini['tiers']) && is_array($gemini['tiers']) ? $gemini['tiers'] : [];
    $tieredPricing = [];
    $baseCostUsd = 0.0;

    if (!empty($rawTiers)) {
        $countT = count($rawTiers);
        for ($i = 0; $i < $countT; $i++) {
            $t = $rawTiers[$i];
            if (!is_array($t)) {
                continue;
            }
            $rawPrice = (float)($t['price'] ?? 0);
            if ($rawPrice <= 0) {
                continue;
            }
            if ($currency === 'CNY' || $currency === 'RMB') {
                $priceUsd = ($cnyRate > 0 && $usdRate > 0) ? ($rawPrice * ($cnyRate / $usdRate)) : ($rawPrice / 7.2);
            } elseif ($currency === 'EUR') {
                $priceUsd = $rawPrice * 1.09;
            } else {
                $priceUsd = $rawPrice;
            }

            if ($baseCostUsd <= 0) {
                $baseCostUsd = $priceUsd;
            }

            $tierMargin = $i === 0 ? $margin : ($i === 1 ? max(5, round($margin * 0.8)) : max(5, round($margin * 0.6)));
            $minQ = max(1, (int)($t['minQuantity'] ?? ($gemini['moq'] ?? 1)));
            $sellUsd = round($priceUsd * (1 + $tierMargin / 100), 2);
            $toman = (int)(round(($priceUsd * $usdRate * (1 + $tierMargin / 100)) / 1000) * 1000);

            $row = [
                'minQuantity' => $minQ,
                'priceUsd' => $sellUsd,
                'marginPercent' => $tierMargin,
                'calculatedPriceToman' => $toman,
            ];
            if (isset($rawTiers[$i + 1]) && is_array($rawTiers[$i + 1]) && !empty($rawTiers[$i + 1]['minQuantity'])) {
                $nextMin = (int)$rawTiers[$i + 1]['minQuantity'];
                if ($nextMin > $minQ) {
                    $row['maxQuantity'] = $nextMin - 1;
                }
            }
            $tieredPricing[] = $row;
        }
    }

    if ($baseCostUsd <= 0) {
        $baseCostUsd = 1.0;
    }

    $extId = !empty($rawItem['externalId']) ? $rawItem['externalId'] : external_id_from_url($sourceUrl);
    $platform = '';
    if (strpos($extId, '1688:') === 0 || strpos($sourceUrl, '1688.com') !== false) {
        $platform = '1688';
    } elseif (strpos($extId, 'alibaba:') === 0 || strpos($sourceUrl, 'alibaba.com') !== false) {
        $platform = 'Alibaba';
    } elseif (strpos($extId, 'mic:') === 0 || strpos($sourceUrl, 'made-in-china.com') !== false) {
        $platform = 'Made-in-China';
    }

    $supIn = isset($gemini['supplier']) && is_array($gemini['supplier']) ? $gemini['supplier'] : [];
    if (empty($supIn['platform']) && $platform !== '') {
        $supIn['platform'] = $platform;
    }

    $moqVal = max(1, (int)($gemini['moq'] ?? ($rawItem['moq'] ?? 1)));

    $productInput = [
        'externalId'          => $extId,
        'sourceUrl'           => $sourceUrl,
        'originalTitle'       => clean($gemini['originalTitle'] ?? ($rawItem['title'] ?? ''), 400),
        'faTitle'             => clean($gemini['faTitle'] ?? '', 300),
        'faShortDesc'         => clean($gemini['faShortDesc'] ?? '', 600),
        'faFullDesc'          => clean($gemini['faFullDesc'] ?? '', 6000),
        'faFeatures'          => isset($gemini['faFeatures']) && is_array($gemini['faFeatures']) ? $gemini['faFeatures'] : [],
        'technicalSpecs'      => isset($gemini['technicalSpecs']) && is_array($gemini['technicalSpecs']) ? $gemini['technicalSpecs'] : [],
        'category'            => clean(!empty($gemini['category']) ? $gemini['category'] : 'عمومی', 100),
        'tags'                => isset($gemini['tags']) && is_array($gemini['tags']) ? $gemini['tags'] : [],
        'mainImage'           => !empty($images[0]) ? $images[0] : '',
        'images'              => $images,
        'costPerUnitUsd'      => round($baseCostUsd, 2),
        'targetMarginPercent' => $margin,
        'moq'                 => $moqVal,
        'trendScore'          => 85,
        'tieredPricing'       => $tieredPricing,
        'supplier'            => $supIn,
    ];

    list($builtProduct, $buildErr) = build_product($productInput, $usdRate, $margin, true);
    if (!$builtProduct) {
        fail('خطا در ساخت محصول: ' . $buildErr, 422);
    }

    $wasUpdated = with_lock('catalog', function () use ($CATALOG_FILE, $builtProduct) {
        $existing = read_json($CATALOG_FILE, []);
        if (!is_array($existing)) {
            $existing = [];
        }
        $updated = false;
        foreach ($existing as &$item) {
            if (
                (!empty($builtProduct['externalId']) && ($item['externalId'] ?? '') === $builtProduct['externalId']) ||
                (!empty($builtProduct['sourceUrl']) && norm_url($item['sourceUrl'] ?? '') === norm_url($builtProduct['sourceUrl']))
            ) {
                $builtProduct['id'] = $item['id'] ?? $builtProduct['id'];
                $item = $builtProduct;
                $updated = true;
                break;
            }
        }
        unset($item);
        if (!$updated) {
            array_unshift($existing, $builtProduct);
        }
        $merged = array_slice($existing, 0, 5000);
        if (is_file($CATALOG_FILE)) {
            @copy($CATALOG_FILE, DATA_DIR . '/catalog.bak.json');
        }
        write_json($CATALOG_FILE, $merged);
        return $updated;
    });
    $chanRes = $wasUpdated ? ['posted' => 0, 'errors' => []] : channel_announce_many([$builtProduct]);

    with_lock('queue', function () use ($rawId) {
        $q2 = queue_load();
        foreach ($q2['raw'] as &$r) {
            if (($r['id'] ?? '') === $rawId) {
                $r['status'] = 'done';
                $r['reason'] = '';
                $r['ts'] = time();
                $r['fullText'] = '';
                $r['attributes'] = [];
                break;
            }
        }
        unset($r);
        queue_save($q2);
    });

    out([
        'success' => true,
        'message' => 'محصول با موفقیت منتشر شد',
        'product_id' => $builtProduct['id'],
        'channel_posted' => $chanRes['posted'],
        'channel_errors' => $chanRes['errors'],
    ]);
}
if ($action === 'get_pricing_config') {
    require_ingest();
    $st = read_json($SETTINGS_FILE, []);
    out(['success' => true, 'marginPercent' => isset($st['targetMarginPercent']) ? (float)$st['targetMarginPercent'] : 25.0]);
}

if ($action === 'queue_status') {
    require_ingest();
    $q = queue_load();
    $c = ['ideas_pending' => 0, 'raw_pending' => 0, 'raw_done' => 0, 'raw_failed' => 0];
    foreach ($q['ideas'] as $i) {
        if (($i['status'] ?? '') === 'pending') {
            $c['ideas_pending']++;
        }
    }
    foreach ($q['raw'] as $r) {
        $k = 'raw_' . ($r['status'] ?? 'pending');
        if (isset($c[$k])) {
            $c[$k]++;
        }
    }
    out(['success' => true] + $c);
}

if ($action === 'scrape_relay') {
    require_ingest();
    $target = isset($_GET['url']) ? (string)$_GET['url'] : (isset($body['url']) ? (string)$body['url'] : '');
    $allowed = ['1688.com', 'alibaba.com', 'made-in-china.com', 'aliexpress.com', 'tgju.org', 'globalsources.com'];
    $host = strtolower((string)parse_url($target, PHP_URL_HOST));
    $ok = false;
    foreach ($allowed as $a) {
        if ($host === $a || substr($host, -strlen($a) - 1) === '.' . $a) {
            $ok = true;
            break;
        }
    }
    if (!is_http_url($target) || !$ok) {
        fail('Target host is not allowed', 403);
    }
    $relay = secret('relay_url');
    $rtoken = secret('relay_token');
    if ($relay === '' || $rtoken === '') {
        fail('Relay is not configured', 503);
    }
    $ch = curl_init(rtrim($relay, '/') . '/?url=' . urlencode($target));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER     => ['X-Relay-Token: ' . $rtoken],
    ]);
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($resp === false) {
        fail('Relay error: ' . $err, 502);
    }
    http_response_code($code ?: 200);
    header('Content-Type: text/plain; charset=utf-8');
    echo $resp;
    exit;
}

/* ---------------- Admin only ---------------- */
$adminActions = [
    'get_products_admin', 'save_products', 'upload_image', 'cache_catalog_images',
    'refresh_rates', 'save_rates', 'get_settings', 'save_settings', 'get_crm', 'save_crm', 'reply_inquiry',
    'telegram_verify', 'verify_telegram', 'telegram_broadcast', 'broadcast_telegram', 'competitor_analysis',
    'channel_post_pending',
    'mark_posted', // FIXED: اکشن mark_posted به لیست ادمین اضافه شد
];
if (in_array($action, $adminActions, true)) {
    require_admin();
}

/* ارسال دستی محصولات منتشرنشده در کانال (حداکثر ۵ تا در هر بار) */
if ($action === 'channel_post_pending' && $method === 'POST') {
    @set_time_limit(60);
    $ids = isset($body['ids']) && is_array($body['ids']) ? $body['ids'] : null;
    $items = read_json($CATALOG_FILE, []);
    $todo = [];
    foreach ((array)$items as $it) {
        if (!is_array($it) || empty($it['id']) || !empty($it['isPostedToTelegram'])) {
            continue;
        }
        if ($ids !== null && !in_array($it['id'], $ids, true)) {
            continue;
        }
        $todo[] = $it;
        if (count($todo) >= 5) {
            break;
        }
    }
    $posted = 0;
    $errors = [];
    foreach ($todo as $i => $it) {
        if ($i > 0) {
            sleep(1);
        }
        list($ok, $err) = channel_announce($it);
        if ($ok) {
            $posted++;
        } else {
            $errors[] = $err;
        }
    }
    out(['success' => true, 'posted' => $posted, 'attempted' => count($todo), 'errors' => $errors]);
}

if ($action === 'get_products_admin') {
    $items = read_json($CATALOG_FILE, []);
    out(['success' => true, 'products' => is_array($items) ? $items : []]);
}

if ($action === 'save_products' && $method === 'POST') {
    $products = isset($body['products']) ? $body['products'] : null;
    if (!is_array($products)) {
        fail('Invalid products payload', 422);
    }
    $r = with_lock('catalog', function () use ($CATALOG_FILE, $products, $body) {
        $current = read_json($CATALOG_FILE, []);
        if (empty($products) && !empty($current) && empty($body['allowEmpty'])) {
            return 'refused';
        }
        if (is_file($CATALOG_FILE)) {
            @copy($CATALOG_FILE, DATA_DIR . '/catalog.bak.json');
        }
        $byId = [];
        foreach ((array)$current as $c) {
            if (is_array($c) && isset($c['id'])) {
                $byId[$c['id']] = $c;
            }
        }
        $sens = ['costPerUnitUsd', 'costPerUnitCny', 'costPerUnitAed', 'shippingEstPerUnitUsd',
                 'customsTariffPercent', 'targetMarginPercent', 'estimatedMarginPercent', 'sourceUrl', 'weightKg', 'routeType', 'customsPerKg'];
        foreach ($products as &$np) {
            if (!is_array($np) || !isset($np['id']) || !isset($byId[$np['id']])) {
                continue;
            }
            $old = $byId[$np['id']];
            foreach ($sens as $k) {
                if (!isset($np[$k]) && isset($old[$k])) {
                    $np[$k] = $old[$k];
                }
            }
            if (isset($old['supplier']) && is_array($old['supplier'])) {
                if (!isset($np['supplier']) || !is_array($np['supplier'])) {
                    $np['supplier'] = [];
                }
                foreach (['name', 'supplierProfileUrl'] as $k) {
                    if (!isset($np['supplier'][$k]) && isset($old['supplier'][$k])) {
                        $np['supplier'][$k] = $old['supplier'][$k];
                    }
                }
            }
            if (!empty($np['tieredPricing']) && is_array($np['tieredPricing']) && !empty($old['tieredPricing'])) {
                foreach ($np['tieredPricing'] as $i => &$t) {
                    if (isset($old['tieredPricing'][$i]) && is_array($t)) {
                        foreach (['priceUsd', 'marginPercent'] as $k) {
                            if (!isset($t[$k]) && isset($old['tieredPricing'][$i][$k])) {
                                $t[$k] = $old['tieredPricing'][$i][$k];
                            }
                        }
                    }
                }
                unset($t);
            }
        }
        unset($np);
        $base = isset($body['baseIds']) && is_array($body['baseIds']) ? array_flip(array_map('strval', $body['baseIds'])) : [];
        $sentIds = [];
        foreach ($products as $np2) {
            if (is_array($np2) && isset($np2['id'])) {
                $sentIds[(string)$np2['id']] = true;
            }
        }
        foreach ((array)$current as $c) {
            if (is_array($c) && isset($c['id']) && !isset($sentIds[(string)$c['id']]) && !isset($base[(string)$c['id']])) {
                $products[] = $c;
            }
        }
        return write_json($CATALOG_FILE, array_values($products)) ? 'ok' : 'error';
    });
    if ($r === 'refused') {
        fail('Refusing to replace a non-empty catalog with an empty list', 409);
    }
    if ($r !== 'ok') {
        fail('Could not save catalog', 500);
    }
    out(['success' => true, 'count' => count($products), 'saved_at' => date('c')]);
}

if ($action === 'mark_posted' && $method === 'POST') {
    require_ingest();
    $ids = isset($body['ids']) && is_array($body['ids']) ? $body['ids'] : [];
    $n = with_lock('catalog', function () use ($CATALOG_FILE, $ids) {
        $items = read_json($CATALOG_FILE, []);
        $count = 0;
        foreach ($items as &$p) {
            if (isset($p['id']) && in_array($p['id'], $ids, true)) {
                $p['isPostedToTelegram'] = true;
                $count++;
            }
        }
        unset($p);
        write_json($CATALOG_FILE, $items);
        return $count;
    });
    out(['success' => true, 'updated' => $n]);
}

if ($action === 'upload_image' && $method === 'POST') {
    $data = null;
    if (!empty($_FILES['image']['tmp_name']) && is_uploaded_file($_FILES['image']['tmp_name'])) {
        if ($_FILES['image']['size'] > 5 * 1024 * 1024) {
            fail('File too large', 413);
        }
        $data = file_get_contents($_FILES['image']['tmp_name']);
    } elseif (!empty($body['image']) && is_string($body['image'])) {
        $b64 = $body['image'];
        if (preg_match('#^data:image/[a-zA-Z0-9.+-]+;base64,#', $b64)) {
            $b64 = substr($b64, strpos($b64, ',') + 1);
        }
        $data = base64_decode($b64, true);
        if ($data !== false && strlen($data) > 5 * 1024 * 1024) {
            fail('File too large', 413);
        }
    }
    if (!$data) {
        fail('No image received', 400);
    }
    $ext = image_ext_from_data($data);
    if (!$ext) {
        fail('File is not a valid jpg/png/gif/webp image', 415);
    }
    $name = 'img_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (file_put_contents(UPLOADS_DIR . '/' . $name, $data) === false) {
        fail('Failed to save image', 500);
    }
    out(['success' => true, 'url' => '/uploads/' . $name, 'full_url' => SITE_ORIGIN . '/uploads/' . $name]);
}

if ($action === 'cache_catalog_images') {
    @set_time_limit(120);
    $limit = 15;
    $summary = with_lock('catalog', function () use ($CATALOG_FILE, $limit) {
        $items = read_json($CATALOG_FILE, []);
        $done = 0;
        $remaining = 0;
        foreach ($items as &$p) {
            $needs = !empty($p['mainImage']) && strpos($p['mainImage'], '/uploads/') === false;
            if (!$needs) {
                continue;
            }
            if ($done >= $limit) {
                $remaining++;
                continue;
            }
            $new = cache_image($p['mainImage']);
            if ($new !== $p['mainImage']) {
                $p['mainImage'] = $new;
                if (!empty($p['images']) && is_array($p['images'])) {
                    $p['images'][0] = $new;
                }
            }
            $done++;
        }
        unset($p);
        write_json($CATALOG_FILE, $items);
        return ['processed' => $done, 'remaining' => $remaining];
    });
    out(['success' => true] + $summary);
}

if ($action === 'refresh_rates') {
    $debug = [];
    $payload = fetch_live_rates($debug);
    if (!$payload) {
        out(['success' => false, 'error' => 'Could not read live rates from TGJU', 'debug' => $debug], 502);
    }
    write_json($RATES_FILE, $payload);
    out(['success' => true, 'rates' => $payload]);
}

if ($action === 'save_rates' && $method === 'POST') {
    $r = isset($body['rates']) && is_array($body['rates']) ? $body['rates'] : $body;
    $usd = (int)(isset($r['usd']) ? $r['usd'] : 0);
    if ($usd <= 0) {
        fail('Invalid rates payload', 422);
    }
    $payload = [
        'usd' => $usd,
        'aed' => (int)(isset($r['aed']) ? $r['aed'] : 0),
        'cny' => (int)(isset($r['cny']) ? $r['cny'] : 0),
        'isLive' => false,
        'source' => 'manual',
        'lastUpdated' => date('H:i:s'),
        'updatedAt' => time(),
    ];
    write_json($RATES_FILE, $payload);
    out(['success' => true, 'rates' => $payload]);
}

if ($action === 'get_ui') {
    $st = read_json($SETTINGS_FILE, []);
    out(['success' => true, 'ui' => (isset($st['ui']) && is_array($st['ui'])) ? $st['ui'] : new stdClass()]);
}

if ($action === 'get_settings') {
    $st = read_json($SETTINGS_FILE, []);
    unset($st['adminPin']);
    // FIXED (امنیتی): توکن کامل بات هرگز به کلاینت ارسال نمی‌شود
    $bt = secret('bot_token');
    if ($bt !== '') {
        $st['botTokenSet'] = true;
        $st['botTokenMasked'] = substr($bt, 0, 6) . '...' . substr($bt, -4);
    }
    if (isset($st['botToken'])) {
        unset($st['botToken']); // اطمینان: اگر قبلاً در settings ذخیره شده باشد هم حذف می‌شود
    }
    out(['success' => true, 'settings' => $st ? $st : new stdClass()]);
}

if ($action === 'save_settings' && $method === 'POST') {
    $in = isset($body['settings']) && is_array($body['settings']) ? $body['settings'] : $body;
    $allowed = ['botToken', 'channelId', 'miniAppUrl', 'adminUsername', 'targetMarginPercent', 'minSupplierYears', 'minRating'];
    $r = with_lock('settings', function () use ($SETTINGS_FILE, $in, $allowed) {
        $cur = read_json($SETTINGS_FILE, []);
        unset($cur['adminPin']);
        foreach ($allowed as $k) {
            if (isset($in[$k]) && (is_string($in[$k]) || is_numeric($in[$k]))) {
                $cur[$k] = is_numeric($in[$k]) ? $in[$k] + 0 : clean($in[$k], 200);
            }
        }
        // اگر توکن جدید ماسک‌شده برگشت (یعنی کاربر تغییرش نداده)، مقدار قبلی حفظ شود
        if (isset($cur['botToken']) && (isset($in['botToken']) && strpos((string)$in['botToken'], '...') !== false)) {
            // توکن ماسک‌شده است — کاری نمی‌کنیم (قبلاً حفظ شده)
        }
        if (isset($in['autoChannelPost'])) {
            $cur['autoChannelPost'] = filter_var($in['autoChannelPost'], FILTER_VALIDATE_BOOLEAN);
        }
        if (isset($in['ui']) && is_array($in['ui'])) {
            // ---- ظاهر مینی‌اپ: هر مقدار اعتبارسنجی و محدود می‌شود ----
            $fonts = ['system-ui', 'Tahoma', 'Segoe UI', 'Arial', 'Vazirmatn'];
            $hex = function ($v, $fallback) {
                return (is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v)) ? strtoupper($v) : $fallback;
            };
            $clampNum = function ($v, $min, $max, $fallback) {
                return (is_numeric($v)) ? round(max($min, min($max, (float)$v)), 2) : $fallback;
            };
            $u = (isset($cur['ui']) && is_array($cur['ui'])) ? $cur['ui'] : [];
            $in_ui = $in['ui'];
            $u['fontFamily'] = (isset($in_ui['fontFamily']) && in_array($in_ui['fontFamily'], $fonts, true)) ? $in_ui['fontFamily'] : ($u['fontFamily'] ?? 'system-ui');
            foreach (['accent', 'pageBg', 'cardBg', 'cardBorder', 'textColor', 'mutedColor', 'buttonBg', 'buttonText'] as $k) {
                $dflt = ['accent' => '#E63946', 'pageBg' => '#17212B', 'cardBg' => '#1E2A36', 'cardBorder' => '#2B3B4A', 'textColor' => '#FFFFFF', 'mutedColor' => '#9AA7B4', 'buttonBg' => '#E63946', 'buttonText' => '#FFFFFF'][$k];
                if (isset($in_ui[$k])) $u[$k] = $hex($in_ui[$k], $u[$k] ?? $dflt);
            }
            $u['radius'] = $clampNum($in_ui['radius'] ?? null, 0, 32, $u['radius'] ?? 14);
            $ranges = ['heading' => [12, 28], 'body' => [10, 20], 'small' => [9, 16], 'price' => [11, 24], 'button' => [10, 18]];
            $roles = (isset($u['roles']) && is_array($u['roles'])) ? $u['roles'] : [];
            foreach ($ranges as $role => $r) {
                $src = (isset($in_ui['roles'][$role]) && is_array($in_ui['roles'][$role])) ? $in_ui['roles'][$role] : [];
                $old = (isset($roles[$role]) && is_array($roles[$role])) ? $roles[$role] : [];
                $roles[$role] = [
                    'size' => $clampNum($src['size'] ?? null, $r[0], $r[1], $old['size'] ?? $r[0]),
                    'weight' => (int)$clampNum($src['weight'] ?? null, 300, 900, $old['weight'] ?? 400),
                    'color' => $hex($src['color'] ?? null, $old['color'] ?? '#FFFFFF'),
                    'lineHeight' => $clampNum($src['lineHeight'] ?? null, 1, 2.5, $old['lineHeight'] ?? 1.5),
                ];
            }
            $u['roles'] = $roles;
            $cur['ui'] = $u;
        }
        write_json($SETTINGS_FILE, $cur);
        return $cur;
    });
    // FIXED: پاسخ بدون توکن کامل
    unset($r['botToken']);
    $bt = secret('bot_token');
    if ($bt !== '') {
        $r['botTokenSet'] = true;
        $r['botTokenMasked'] = substr($bt, 0, 6) . '...' . substr($bt, -4);
    }
    out(['success' => true, 'settings' => $r, 'saved_at' => date('c')]);
}

if ($action === 'get_crm') {
    out(read_json($CRM_FILE, ['customers' => [], 'inquiries' => []]) + ['success' => true]);
}

if ($action === 'save_crm' && $method === 'POST') {
    if (!isset($body['customers']) || !isset($body['inquiries']) || !is_array($body['customers']) || !is_array($body['inquiries'])) {
        fail('Invalid CRM payload', 422);
    }
    with_lock('crm', function () use ($CRM_FILE, $body) {
        write_json($CRM_FILE, ['customers' => $body['customers'], 'inquiries' => $body['inquiries']]);
    });
    out(['success' => true, 'saved_at' => date('c')]);
}

if ($action === 'reply_inquiry' && $method === 'POST') {
    $id = clean(isset($body['inquiryId']) ? $body['inquiryId'] : '', 100);
    $text = clean(isset($body['text']) ? $body['text'] : '', 3000);
    if ($id === '' || $text === '') {
        fail('inquiryId and text are required', 422);
    }
    $found = with_lock('crm', function () use ($CRM_FILE, $id, $text, $body) {
        $crm = read_json($CRM_FILE, ['customers' => [], 'inquiries' => []]);
        foreach ($crm['inquiries'] as &$q) {
            if (isset($q['id']) && $q['id'] === $id) {
                if (!isset($q['replies']) || !is_array($q['replies'])) {
                    $q['replies'] = [];
                }
                $q['replies'][] = ['by' => 'admin', 'text' => $text, 'at' => date('c')];
                $q['status'] = isset($body['status']) ? clean($body['status'], 20) : 'answered';
                $copy = $q;
                unset($q);
                write_json($CRM_FILE, $crm);
                return $copy;
            }
        }
        return null;
    });
    if (!$found) {
        fail('Inquiry not found', 404);
    }
    $notified = false;
    if (!empty($found['telegramUserId'])) {
        $r = tg_call('sendMessage', [
            'chat_id' => (int)$found['telegramUserId'],
            'text' => "پاسخ به استعلام شما (" . $found['id'] . "):\n\n" . $text,
        ]);
        $notified = !empty($r['ok']);
    }
    out(['success' => true, 'customer_notified' => $notified]);
}

if ($action === 'telegram_verify' || $action === 'verify_telegram') {
    out(tg_call('getMe', []));
}
if ($action === 'telegram_broadcast' || $action === 'broadcast_telegram') {
    $st = read_json($SETTINGS_FILE, []);

    $chat = '';
    foreach (['chatId', 'chat_id', 'channelId', 'channel_id'] as $ck) {
        if (!empty($body[$ck]) && is_string($body[$ck])) {
            $chat = trim($body[$ck]);
            break;
        }
    }
    if ($chat === '') {
        $chat = secret('channel_id') !== '' ? trim(secret('channel_id')) : (isset($st['channelId']) ? trim((string)$st['channelId']) : '@NafisSmartTrade');
    }
    if ($chat !== '' && $chat[0] !== '@' && !preg_match('/^-?\d+$/', $chat)) {
        $chat = '@' . $chat;
    }

    $rawText = isset($body['caption']) ? (string)$body['caption'] : (isset($body['text']) ? (string)$body['text'] : '');
    $cleanText = str_replace('**', '', $rawText);
    $caption = mb_substr($cleanText, 0, 1020, 'UTF-8');

    $photo = !empty($body['photo']) ? trim((string)$body['photo']) : (!empty($body['photoUrl']) ? trim((string)$body['photoUrl']) : '');
    $markup = isset($body['replyMarkup']) ? $body['replyMarkup'] : (isset($body['reply_markup']) ? $body['reply_markup'] : null);
    if (is_string($markup)) {
        $dec = json_decode($markup, true);
        if (is_array($dec)) {
            $markup = $dec;
        }
    }

    if (is_array($markup) && isset($markup['inline_keyboard']) && is_array($markup['inline_keyboard'])) {
        foreach ($markup['inline_keyboard'] as &$row) {
            if (!is_array($row)) continue;
            foreach ($row as &$btn) {
                if (isset($btn['web_app'])) {
                    $btn['url'] = isset($btn['web_app']['url']) ? $btn['web_app']['url'] : SITE_ORIGIN;
                    unset($btn['web_app']);
                }
                if (isset($btn['url']) && strpos($btn['url'], 'https://') !== 0 && strpos($btn['url'], 'http://') !== 0 && strpos($btn['url'], 'tg://') !== 0) {
                    $btn['url'] = SITE_ORIGIN;
                }
            }
            unset($btn);
        }
        unset($row);
    }

    $result = null;
    $lastError = '';

    if ($photo !== '' && is_http_url($photo)) {
        $cachedUrl = cache_image($photo);
        $payload = [
            'chat_id' => $chat,
            'photo'   => $cachedUrl,
            'caption' => $caption,
        ];
        if ($markup) {
            $payload['reply_markup'] = $markup;
        }
        $r = tg_call('sendPhoto', $payload);
        if (!empty($r['ok'])) {
            $result = $r;
        } else {
            $lastError = isset($r['description']) ? $r['description'] : '';
        }
    }

    if (!$result) {
        $msgText = $cleanText !== '' ? mb_substr($cleanText, 0, 4000, 'UTF-8') : 'محصول جدید نفیس تجارت هوشمند (NFS)';
        $payload = [
            'chat_id' => $chat,
            'text'    => $msgText,
        ];
        if ($markup) {
            $payload['reply_markup'] = $markup;
        }
        $r = tg_call('sendMessage', $payload);
        if (!empty($r['ok'])) {
            $result = $r;
        } else {
            $lastError = isset($r['description']) ? $r['description'] : ($lastError ?: 'خطای نامشخص از سمت تلگرام');
            out([
                'ok'          => false,
                'success'     => false,
                'error'       => 'خطای تلگرام (' . $chat . '): ' . $lastError,
                'description' => 'خطای تلگرام (' . $chat . '): ' . $lastError,
            ], 200);
        }
    }

    $result['ok'] = true;
    $result['success'] = true;
    out($result);
}

if ($action === 'competitor_analysis') {
    $title = clean(isset($body['productTitle']) ? $body['productTitle'] : 'کالا', 200);
    $w = (float)(isset($body['wholesalePriceToman']) ? $body['wholesalePriceToman'] : 0);
    if ($w <= 0) {
        fail('wholesalePriceToman is required', 422);
    }
    $avg = (int)(round($w * 1.55 / 1000) * 1000);
    out([
        'success' => true,
        'isEstimate' => true,
        'note' => 'تخمین بر اساس ضریب ثابت است و داده واقعی بازار نیست',
        'data' => [
            'marketTitle' => $title,
            'avgRetailPriceToman' => $avg,
            'minRetailPriceToman' => (int)(round($w * 1.35 / 1000) * 1000),
            'maxRetailPriceToman' => (int)(round($w * 1.85 / 1000) * 1000),
            'suggestedRetailPriceToman' => (int)(round($w * 1.45 / 1000) * 1000),
        ],
    ]);
}

out(['ok' => true, 'message' => 'NFS Host API online', 'api_version' => API_VERSION]);

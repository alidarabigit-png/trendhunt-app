<?php
/**
 * شبیه‌ساز هاست محلی — روتر php -S که rewriteهای public/.htaccess را
 * روی خروجی build (dist/) پیاده می‌کند تا رفتارش شبیه هاست اشتراکی شود.
 *
 * اجرا:
 *   npm run build
 *   php -S 0.0.0.0:3002 -t dist tools/serve-host-local.php
 *
 * نکته: کلید ادمین از nfs-secrets.php ریشه (الگو) یا از متغیر محیطی
 * NFS_ADMIN_KEY خوانده می‌شود؛ برای تست محلی می‌توان مقدار دلخواه داد.
 */

$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/');
$uri     = urldecode((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$rel     = ($uri === '' || $uri === '/') ? '/index.html' : $uri;
$file    = $docRoot . $rel;

// فایل واقعی (asset، api.php، ...) → به سرور built-in می‌سپاریم
if ($rel !== '/' && is_file($file)) {
    return false;
}

// --- RewriteRule ^api/telegram/broadcast/?$ api.php?action=telegram_broadcast [QSA,L]
// --- RewriteRule ^api/telegram/verify/?$    api.php?action=telegram_verify    [QSA,L]
// --- RewriteRule ^api/catalog/?$            api.php?action=get_products       [QSA,L]
// --- RewriteRule ^api/settings/?$           api.php?action=get_settings       [QSA,L]
$map = [
    '/api/telegram/broadcast' => 'telegram_broadcast',
    '/api/telegram/verify'    => 'telegram_verify',
    '/api/catalog'            => 'get_products',
    '/api/settings'           => 'get_settings',
];
$path = rtrim($uri, '/');

if (isset($map[$path])) {
    $_GET['action'] = $map[$path];
    require $docRoot . '/api.php';
    return true;
}

// --- RewriteRule ^api/(.*)$ api.php?action=$1 [QSA,L]
if (preg_match('#^api/(.+)$#', $path, $m)) {
    $_GET['action'] = $m[1];
    require $docRoot . '/api.php';
    return true;
}

// --- SPA fallback: RewriteCond !-f / !-d → /index.html
if (is_file($file)) {
    readfile($file);
    return true;
}
readfile($docRoot . '/index.html');
return true;

<?php
/**
 * Plugin Name: FlowTrack Analytics
 * Description: Private administrator dashboard for optional, anonymous FlowTrack usage counts. No financial records are collected.
 * Version: 1.0.0
 * Author: Ikomeflow
 * Requires PHP: 7.4
 */
defined('ABSPATH') || exit;

final class FlowTrack_Analytics {
    const ORIGIN = 'https://flowtrack.ikomeflow.com';
    const EVENTS = ['app_open','page_view','heartbeat','transaction_created','transaction_updated','transaction_deleted','backup_exported','pdf_exported','backup_restored'];
    const VIEWS = ['overview','transactions','calendar','settings','locked','setup'];

    static function table($suffix='events') { global $wpdb; return $wpdb->prefix.'flowtrack_analytics_'.$suffix; }
    static function activate() {
        global $wpdb;
        require_once ABSPATH.'wp-admin/includes/upgrade.php';
        $charset=$wpdb->get_charset_collate();
        $events=self::table(); $rates=self::table('rates');
        dbDelta("CREATE TABLE $events (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id char(64) NOT NULL,
            visitor char(64) NOT NULL,
            session_id char(64) NOT NULL,
            event_name varchar(32) NOT NULL,
            view_name varchar(16) NOT NULL,
            local_day date NOT NULL,
            received_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY event_id (event_id),
            KEY received_at (received_at),
            KEY local_day (local_day)
        ) $charset;");
        dbDelta("CREATE TABLE $rates (
            bucket char(64) NOT NULL,
            hits int(11) unsigned NOT NULL,
            expires_at datetime NOT NULL,
            PRIMARY KEY  (bucket),
            KEY expires_at (expires_at)
        ) $charset;");
        if (!wp_next_scheduled('flowtrack_analytics_cleanup')) wp_schedule_event(time(),'hourly','flowtrack_analytics_cleanup');
        update_option('flowtrack_analytics_installed',gmdate('c'),false);
    }
    static function deactivate() { wp_clear_scheduled_hook('flowtrack_analytics_cleanup'); }
    static function cleanup() {
        global $wpdb;
        $wpdb->query($wpdb->prepare('DELETE FROM '.self::table().' WHERE received_at < %s',gmdate('Y-m-d H:i:s',time()-30*DAY_IN_SECONDS)));
        $wpdb->query($wpdb->prepare('DELETE FROM '.self::table('rates').' WHERE expires_at < %s',gmdate('Y-m-d H:i:s')));
    }
    static function hash($value) { return hash_hmac('sha256',$value,wp_salt('auth')); }
    static function valid($data) {
        if (!is_array($data) || count($data)!==6 || array_diff(array_keys($data),['v','id','visitor','session','event','view']) || ($data['v']??null)!==1) return false;
        foreach (['id','visitor','session'] as $key) {
            if (!isset($data[$key]) || !is_string($data[$key]) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',$data[$key])) return false;
        }
        return in_array($data['event']??null,self::EVENTS,true) && in_array($data['view']??null,self::VIEWS,true);
    }
    static function error($code,$status) { return new WP_Error('flowtrack_'.$code,$code,['status'=>$status]); }
    static function allowed($request) {
        // This is a public anonymous collector, never an authentication mechanism.
        // Origin protects browsers; non-browser clients can still forge activity.
        return $request->get_header('origin')===self::ORIGIN ? true : self::error('origin_denied',403);
    }
    static function quota($key,$limit,$expires) {
        global $wpdb;
        $table=self::table('rates'); $bucket=self::hash($key);
        $ok=$wpdb->query($wpdb->prepare("INSERT INTO $table (bucket,hits,expires_at) VALUES (%s,1,%s) ON DUPLICATE KEY UPDATE hits=hits+1",$bucket,$expires));
        if ($ok===false) return false;
        return (int)$wpdb->get_var($wpdb->prepare("SELECT hits FROM $table WHERE bucket=%s",$bucket)) <= $limit;
    }
    static function collect($request) {
        global $wpdb;
        if (self::allowed($request)!==true) return self::error('origin_denied',403);
        $body=$request->get_body();
        if (strlen($body)>1024) return self::error('body_too_large',413);
        $data=json_decode($body,true);
        if (!self::valid($data)) return self::error('invalid_event',400);
        if ($request->get_header('sec-gpc')==='1' || $request->get_header('dnt')==='1') return new WP_REST_Response(null,204);
        $now=time();
        // Only a salted, minute-specific rate-limit bucket is stored, never an IP address.
        $ip=isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
        if (!self::quota('minute:'.floor($now/60).':'.$ip,120,gmdate('Y-m-d H:i:s',$now+120)) ||
            !self::quota('global:'.gmdate('Y-m-d'),100000,gmdate('Y-m-d H:i:s',$now+DAY_IN_SECONDS))) return self::error('rate_limited',429);
        $inserted=$wpdb->query($wpdb->prepare('INSERT IGNORE INTO '.self::table().' (event_id,visitor,session_id,event_name,view_name,local_day,received_at) VALUES (%s,%s,%s,%s,%s,%s,%s)',
            self::hash('event:'.$data['id']),self::hash('visitor:'.$data['visitor']),self::hash('session:'.$data['session']),$data['event'],$data['view'],wp_date('Y-m-d',$now),gmdate('Y-m-d H:i:s',$now)));
        if ($inserted===false) return self::error('storage_unavailable',503);
        return new WP_REST_Response(null,204);
    }
    static function routes() {
        register_rest_route('flowtrack-analytics/v1','/collect',[
            'methods'=>'POST','callback'=>[__CLASS__,'collect'],'permission_callback'=>[__CLASS__,'allowed']
        ]);
    }
    static function cors($served,$result,$request,$server) {
        if ($request->get_route()!=='/flowtrack-analytics/v1/collect') return $served;
        header_remove('Access-Control-Allow-Origin');header_remove('Access-Control-Allow-Credentials');
        if ($request->get_header('origin')===self::ORIGIN) {
            header('Access-Control-Allow-Origin: '.self::ORIGIN);
            header('Access-Control-Allow-Methods: POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type');
        }
        header('Vary: Origin',false);header('Cache-Control: no-store, private');
        return $served;
    }
    static function stats($days) {
        global $wpdb;
        $table=self::table(); $now=time();
        $start=wp_date('Y-m-d',$now);
        $first=(new DateTimeImmutable('today',wp_timezone()))->modify('-'.($days-1).' days')->format('Y-m-d');
        // Every read excludes expired records even if WP-Cron is delayed.
        $cutoff=gmdate('Y-m-d H:i:s',$now-30*DAY_IN_SECONDS);
        $summary=$wpdb->get_row($wpdb->prepare("SELECT COUNT(DISTINCT visitor) AS active, COUNT(DISTINCT session_id) AS sessions, COALESCE(SUM(event_name='page_view'),0) AS views, COALESCE(SUM(event_name NOT IN ('heartbeat','page_view','app_open')),0) AS actions FROM $table WHERE local_day=%s AND received_at >= %s",$start,$cutoff),ARRAY_A);
        $summary['live']=(int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT visitor) FROM $table WHERE received_at >= %s",gmdate('Y-m-d H:i:s',$now-300)));
        $summary['last_event']=$wpdb->get_var($wpdb->prepare("SELECT MAX(received_at) FROM $table WHERE received_at >= %s",$cutoff));
        $daily=$wpdb->get_results($wpdb->prepare("SELECT local_day AS day, COUNT(DISTINCT visitor) AS active, COUNT(DISTINCT session_id) AS sessions FROM $table WHERE local_day >= %s AND received_at >= %s GROUP BY local_day ORDER BY local_day",$first,$cutoff),ARRAY_A);
        $events=$wpdb->get_results($wpdb->prepare("SELECT event_name AS event, COUNT(*) AS count FROM $table WHERE local_day >= %s AND received_at >= %s AND event_name <> 'heartbeat' GROUP BY event_name ORDER BY count DESC",$first,$cutoff),ARRAY_A);
        if ($wpdb->last_error) return null;
        return ['summary'=>$summary,'daily'=>$daily,'events'=>$events,'days'=>$days,'today'=>$start,'timezone'=>wp_timezone_string(),'updated'=>gmdate('c'),'installed'=>get_option('flowtrack_analytics_installed')];
    }
    static function ajax() {
        if (!current_user_can('manage_options')) wp_send_json_error(['message'=>'Forbidden'],403);
        check_ajax_referer('flowtrack_analytics','nonce');
        nocache_headers();
        $stats=self::stats(isset($_GET['days']) && (string)$_GET['days']==='7' ? 7 : 30);
        if ($stats===null) wp_send_json_error(['message'=>'Analytics storage is unavailable.'],503);
        wp_send_json_success($stats);
    }
    static function menu() { add_menu_page('FlowTrack Analytics','FlowTrack Analytics','manage_options','flowtrack-analytics',[__CLASS__,'page'],'dashicons-chart-area',30); }
    static function page() {
        if (!current_user_can('manage_options')) wp_die('Forbidden','Forbidden',['response'=>403]);
        wp_enqueue_style('flowtrack-analytics',plugins_url('dashboard.css',__FILE__),[], '1.0.0');
        wp_enqueue_script('flowtrack-analytics',plugins_url('dashboard.js',__FILE__),[], '1.0.0',true);
        wp_localize_script('flowtrack-analytics','FlowTrackDashboard',['url'=>admin_url('admin-ajax.php'),'nonce'=>wp_create_nonce('flowtrack_analytics')]);
        ?>
        <div class="wrap fta"><p class="fta-eyebrow">FLOWTRACK · APP USAGE</p><h1>FlowTrack Analytics</h1>
        <p>Anonymous usage from people who allow optional analytics. Financial records stay in their browser.</p>
        <div class="fta-toolbar"><label for="fta-days">Trend period</label> <select id="fta-days"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option></select> <button class="button" id="fta-refresh">Refresh</button> <span id="fta-status" role="status">Loading…</span></div>
        <div class="fta-cards"><article><h2>Daily active users</h2><strong id="fta-active">—</strong><p>Unique participating browsers today</p></article><article><h2>Live active users ≈</h2><strong id="fta-live">—</strong><p>Active in the last 5 minutes</p></article><article><h2>Sessions today</h2><strong id="fta-sessions">—</strong><p>A new session after 30 minutes away</p></article><article><h2>App actions today</h2><strong id="fta-actions">—</strong><p>Successful saves, deletes and exports</p></article></div>
        <p id="fta-empty" class="fta-note" hidden>No activity received yet. Counts start after the app update and a visitor allows analytics.</p>
        <div class="fta-columns"><section class="fta-panel"><h2>Daily activity</h2><p id="fta-timezone"></p><table class="widefat striped"><thead><tr><th>Date</th><th>Active browsers</th><th>Sessions</th><th>Trend</th></tr></thead><tbody id="fta-daily"></tbody></table></section><section class="fta-panel"><h2>App activity</h2><p>Counts for the selected period. No amounts, names, notes, tags or account identifiers.</p><table class="widefat striped"><thead><tr><th>Event</th><th>Count</th></tr></thead><tbody id="fta-events"></tbody></table><p id="fta-last"></p></section></div>
        <details class="fta-panel"><summary>How these numbers work</summary><p>“Users” means anonymous browser identifiers, not registered people. Multiple tabs share an identifier; different devices, cleared storage and identifiers rotating after 30 days can count separately. Sessions crossing midnight appear on both days. Live users are approximate: visible pages send a heartbeat about once a minute, stopping after five minutes without interaction. Closing a page can take five minutes to disappear.</p><p>Analytics are off until a visitor opts in. Global Privacy Control and Do Not Track are respected. Offline activity is not queued. There is no historical backfill. These are estimates and the public collection endpoint cannot prove that events came from a real person.</p><p>Only fixed event names, fixed screen names, server timestamps and salted anonymous identifiers are stored. Records expire after 30 days and are removed by hourly WordPress cleanup; expired records are excluded from every report. Rate-limit buckets expire within a day. No IP addresses, user agents, referrers, URLs, transaction contents, PINs or payment data are stored by this plugin. The hosting provider may retain normal request logs.</p><p>Only WordPress administrators with manage_options access can view this dashboard. It refreshes every 60 seconds while visible. No subscriptions or payment features are included.</p></details></div>
        <?php
    }
}
register_activation_hook(__FILE__,['FlowTrack_Analytics','activate']);
register_deactivation_hook(__FILE__,['FlowTrack_Analytics','deactivate']);
add_action('rest_api_init',['FlowTrack_Analytics','routes']);
add_filter('rest_pre_serve_request',['FlowTrack_Analytics','cors'],20,4);
add_action('admin_menu',['FlowTrack_Analytics','menu']);
add_action('wp_ajax_flowtrack_analytics_stats',['FlowTrack_Analytics','ajax']);
add_action('flowtrack_analytics_cleanup',['FlowTrack_Analytics','cleanup']);

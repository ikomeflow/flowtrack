<?php
// Execute the report SQL against a real in-memory database with controlled histories.
define('ABSPATH',__DIR__.'/');define('DAY_IN_SECONDS',86400);define('ARRAY_A','ARRAY_A');
date_default_timezone_set('UTC');
function register_activation_hook(...$a){}function register_deactivation_hook(...$a){}function add_action(...$a){}function add_filter(...$a){}
function wp_salt($x){return 'fixture-salt';}function wp_date($format,$time){return gmdate($format,$time);}function wp_timezone(){return new DateTimeZone('UTC');}function wp_timezone_string(){return 'UTC';}function get_option($key){return '2026-10-30';}
class WP_Error{public $data;function __construct($code,$msg,$data){$this->data=$data;}}
class WP_REST_Response{public $status;function __construct($body,$status){$this->status=$status;}}
class InsightRequest{private $body;function __construct($data){$this->body=json_encode($data);}function get_body(){return $this->body;}function get_header($key){return $key==='origin'?'https://flowtrack.ikomeflow.com':'';}}
require __DIR__.'/../wordpress/flowtrack-analytics/flowtrack-analytics.php';
function check($value,$label){if(!$value)throw new RuntimeException($label);echo "PASS $label\n";}
class InsightDB{
 public $prefix='test_',$last_error='',$pdo;
 function __construct(){
  $this->pdo=class_exists('Pdo\\Sqlite')?new Pdo\Sqlite('sqlite::memory:'):new PDO('sqlite::memory:');$this->pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
  $dateDiff=function($a,$b){return (int)((strtotime($a)-strtotime($b))/86400);};
  if(method_exists($this->pdo,'createFunction'))$this->pdo->createFunction('DATEDIFF',$dateDiff,2);else $this->pdo->sqliteCreateFunction('DATEDIFF',$dateDiff,2);
  $this->pdo->exec("CREATE TABLE test_flowtrack_analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE,visitor TEXT,session_id TEXT,event_name TEXT,view_name TEXT,device TEXT DEFAULT 'unknown',app_mode TEXT DEFAULT 'unknown',app_version TEXT DEFAULT 'legacy',error_code TEXT DEFAULT 'none',local_day TEXT,received_at TEXT)");
  $this->pdo->exec('CREATE TABLE test_flowtrack_analytics_rates (bucket TEXT PRIMARY KEY,hits INTEGER,expires_at TEXT)');
 }
 function prepare($sql,...$args){$i=0;return preg_replace_callback('/%[sd]/',function($m)use(&$i,$args){$value=$args[$i++];return $m[0]==='%d'?(string)(int)$value:$this->pdo->quote((string)$value);},$sql);}
 function statement($sql){$this->last_error='';try{return $this->pdo->query($sql);}catch(Throwable $e){$this->last_error=$e->getMessage();throw $e;}}
 function get_row($sql,$type=null){return $this->statement($sql)->fetch(PDO::FETCH_ASSOC);}
 function get_results($sql,$type=null){return $this->statement($sql)->fetchAll(PDO::FETCH_ASSOC);}
 function get_var($sql){return $this->statement($sql)->fetchColumn();}
 function query($sql){$sql=str_replace('INSERT IGNORE INTO','INSERT OR IGNORE INTO',$sql);$sql=str_replace('ON DUPLICATE KEY UPDATE hits=hits+1','ON CONFLICT(bucket) DO UPDATE SET hits=hits+1',$sql);$this->last_error='';return $this->pdo->exec($sql);}
}
$wpdb=new InsightDB();$clock=strtotime('2026-10-30 12:00:00 UTC');
$empty=FlowTrack_Analytics::stats(7,$clock);check($empty['retention']['rate']===null,'empty cohort is collecting data, not 0 percent');check($empty['funnel']['started']===0,'empty funnel has no invented completions');
function fixture($name,$offset,$event='app_open',$view='overview',$device='desktop',$mode='browser',$version='1.15.0',$error='none'){
 global $wpdb,$clock;$time=$clock+$offset*86400;
 $wpdb->query($wpdb->prepare('INSERT INTO test_flowtrack_analytics_events (event_id,visitor,session_id,event_name,view_name,device,app_mode,app_version,error_code,local_day,received_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',bin2hex(random_bytes(16)),hash('sha256',$name),hash('sha256',$name.$offset),$event,$view,$device,$mode,$version,$error,gmdate('Y-m-d',$time),gmdate('Y-m-d H:i:s',$time)));
}
fixture('a',0,'setup_started','setup');fixture('a',0,'pin_setup_completed','setup');fixture('a',0,'first_transaction');fixture('a',0,'transaction_created');fixture('a',0,'page_view','settings');
fixture('b',-10);fixture('b',-9);fixture('b',0,'app_open','overview','mobile','installed');
fixture('c',-12);fixture('d',-3);fixture('d',0);fixture('e',-14);fixture('e',-6);fixture('f',-8);fixture('f',-1);fixture('g',-31);fixture('g',0);fixture('immature',-7);
fixture('j',0,'first_transaction');fixture('k',0,'pin_setup_completed');fixture('k',0,'setup_started');fixture('k',0,'first_transaction');fixture('l',0,'setup_started');fixture('l',0,'first_transaction');fixture('l',0,'pin_setup_completed');fixture('legacy',0,'app_open','overview','unknown','unknown','legacy');
fixture('a',0,'app_error','overview','desktop','browser','1.15.0','save_failed');fixture('b',0,'app_error','overview','mobile','installed','1.15.0','pdf_export_failed');
$data=FlowTrack_Analytics::stats(7,$clock);
check((int)$data['summary']['active']===8,'today counts distinct browsers across sessions and events');
check((int)$data['returning']['new_browsers']===6 && (int)$data['returning']['returning_browsers']===2,'new and returning use only retained history');
check((int)$data['retention']['cohort']===4,'return cohort excludes incomplete follow-up and expired history');
check((int)$data['retention']['returned']===2 && $data['retention']['rate']==50.0,'return rate includes day seven and excludes day eight');
check($data['funnel']===['started'=>3,'pin'=>2,'first_transaction'=>1],'funnel requires setup, PIN and first transaction in order');
check((int)$data['summary']['actions']===1 && (int)$data['summary']['errors']===2,'errors and setup steps never inflate successful app actions');
check(count($data['errors'])===2 && (int)$data['errors'][0]['browsers']===1,'safe error summaries count affected browsers');
check(count($data['devices'])===3 && count($data['versions'])===2,'device, installed access and legacy version categories are preserved');
check(in_array('settings',array_column($data['screens'],'screen'),true),'feature popularity includes workspace screens');
check(!array_key_exists('visitor',$data) && !array_key_exists('visitor',$data['funnel']),'reports expose aggregates, not browser identifier lists');
$wpdb=new InsightDB();$_SERVER['REMOTE_ADDR']='192.0.2.1';
$payload=['v'=>2,'id'=>'11111111-1111-4111-8111-111111111111','visitor'=>'22222222-2222-4222-8222-222222222222','session'=>'33333333-3333-4333-8333-333333333333','event'=>'app_error','view'=>'overview','device'=>'mobile','mode'=>'installed','version'=>'1.15.0','error'=>'save_failed'];
check(FlowTrack_Analytics::collect(new InsightRequest($payload))->status===204,'collector stores valid context and safe failure code');
check(FlowTrack_Analytics::collect(new InsightRequest($payload))->status===204 && (int)$wpdb->get_var('SELECT COUNT(*) FROM test_flowtrack_analytics_events')===1,'duplicate event IDs do not duplicate statistics');
$row=$wpdb->get_row('SELECT * FROM test_flowtrack_analytics_events');check($row['visitor']!==$payload['visitor'] && $row['session_id']!==$payload['session'] && $row['error_code']==='save_failed','stored identifiers are salted hashes and error content is bounded');
$expires=gmdate('Y-m-d H:i:s',time()+120);check(FlowTrack_Analytics::quota('fixture-quota',2,$expires) && FlowTrack_Analytics::quota('fixture-quota',2,$expires) && !FlowTrack_Analytics::quota('fixture-quota',2,$expires),'rate limit enforces the configured threshold');
$wpdb->query($wpdb->prepare("INSERT INTO test_flowtrack_analytics_events (event_id,received_at) VALUES ('expired',%s)",gmdate('Y-m-d H:i:s',time()-31*86400)));FlowTrack_Analytics::cleanup();check((int)$wpdb->get_var('SELECT COUNT(*) FROM test_flowtrack_analytics_events')===1,'retention cleanup removes expired rows and preserves current records');
echo "Insights SQL and storage checks passed.\n";

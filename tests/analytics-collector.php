<?php
// Isolated contract/security checks. Live installation additionally verifies the real WP database.
define('ABSPATH',__DIR__.'/');define('DAY_IN_SECONDS',86400);
function register_activation_hook(...$args){} function register_deactivation_hook(...$args){} function add_action(...$args){} function add_filter(...$args){}
function wp_salt($x){return 'test-only-salt';}
class WP_Error { public $code,$data; function __construct($code,$msg,$data){$this->code=$code;$this->data=$data;} }
class WP_REST_Response { public $status;function __construct($body,$status){$this->status=$status;} }
class Request { private $data,$headers;function __construct($data,$headers=[]){$this->data=$data;$this->headers=$headers;}function get_body(){return $this->data;}function get_header($name){return $this->headers[$name]??'';} }
require __DIR__.'/../wordpress/flowtrack-analytics/flowtrack-analytics.php';
function check($ok,$label){if(!$ok)throw new Exception($label);echo "PASS $label\n";}
$valid=['v'=>1,'id'=>'11111111-1111-4111-8111-111111111111','visitor'=>'22222222-2222-4222-8222-222222222222','session'=>'33333333-3333-4333-8333-333333333333','event'=>'app_open','view'=>'overview'];
check(FlowTrack_Analytics::valid($valid),'valid bounded event');
foreach (['amount'=>300,'notes'=>'private','email'=>'private@example.test','url'=>'https://private.test/?token=x','tags'=>['private']] as $key=>$value){$bad=$valid;$bad[$key]=$value;check(!FlowTrack_Analytics::valid($bad),'reject extra '.$key);}
foreach (['id'=>"x' OR 1=1",'visitor'=>'123','session'=>null,'event'=>'purchase','view'=>'account@example.test','v'=>'1'] as $key=>$value){$bad=$valid;$bad[$key]=$value;check(!FlowTrack_Analytics::valid($bad),'reject malformed '.$key);}
check(FlowTrack_Analytics::allowed(new Request('')) instanceof WP_Error,'deny missing origin');
check(FlowTrack_Analytics::allowed(new Request('',['origin'=>'https://evil.example'])) instanceof WP_Error,'deny foreign origin');
$headers=['origin'=>FlowTrack_Analytics::ORIGIN];
check(FlowTrack_Analytics::collect(new Request(str_repeat('x',1025),$headers))->data['status']===413,'reject oversized request before storage');
check(FlowTrack_Analytics::collect(new Request('{bad',$headers))->data['status']===400,'reject malformed JSON');
check(FlowTrack_Analytics::collect(new Request(json_encode($valid),$headers+['sec-gpc'=>'1']))->status===204,'GPC discards before storage');
check(FlowTrack_Analytics::collect(new Request(json_encode($valid),$headers+['dnt'=>'1']))->status===204,'DNT discards before storage');
check(strlen(FlowTrack_Analytics::hash('visitor:test'))===64,'salted identifiers');
check(FlowTrack_Analytics::hash('visitor:test')!==FlowTrack_Analytics::hash('session:test'),'identifier domains separated');
echo "Collector contract checks passed.\n";

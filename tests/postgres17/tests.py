"""Creates its own disposable PostgreSQL 17 cluster. Never accepts a DSN.
Usage: python tests/postgres17/tests.py --pg-bin /path/to/postgresql17/bin
Auth/Storage schemas are fixtures; this is not hosted Supabase testing.
"""
import argparse, concurrent.futures, json, os, pathlib, socket, subprocess, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', required=True)
    args = parser.parse_args()
    binary = pathlib.Path(args.pg_bin).resolve()
    suffix = '.exe' if os.name == 'nt' else ''
    results = []
    for key in list(os.environ):
        if key.startswith('PG'):
            os.environ.pop(key)
    os.environ['PGCLIENTENCODING'] = 'UTF8'
    def run(name, *argv):
        # Windows server children can inherit pipe handles from pg_ctl and keep
        # communicate() waiting after pg_ctl exits. A temporary output file has
        # no EOF dependency on the long-running server process.
        if name == 'pg_ctl':
            with tempfile.TemporaryFile() as output:
                p = subprocess.run([str(binary / (name + suffix)), *map(str, argv)], stdout=output, stderr=subprocess.STDOUT, timeout=120)
                output.seek(0)
                text = output.read().decode('utf-8', errors='replace')
                if p.returncode:
                    raise RuntimeError(name + ': ' + text[-3000:])
                return text.strip()
        p = subprocess.run([str(binary / (name + suffix)), *map(str, argv)], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
        if p.returncode:
            raise RuntimeError(name + ': ' + p.stdout[-500:] + p.stderr[-3000:])
        return p.stdout.strip()
    version = run('postgres', '--version')
    if ' 17.' not in version:
        raise RuntimeError('PostgreSQL 17 required: ' + version)
    directory = pathlib.Path(tempfile.mkdtemp(prefix='almumez-pg17-')).resolve()
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    conn = ['-X','-h','127.0.0.1','-p',str(port),'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At']
    def sql(text):
        return run('psql', *conn, '-c', text)
    def file(path):
        return run('psql', *conn, '-f', path)
    def passed(name):
        results.append({'name':name,'status':'Passed and tested'})
    def check(name, expr):
        if sql('select coalesce((' + expr + '),false)::text') != 'true':
            raise AssertionError(name)
        passed(name)
    started = False
    failure = None
    try:
        run('initdb','-D',directory/'data','-U','postgres','-A','trust','--locale=C','-E','UTF8')
        run('pg_ctl','-D',directory/'data','-l',directory/'server.log','-o','-h 127.0.0.1 -p '+str(port)+' -c wal_level=logical','-w','start')
        started = True
        file(ROOT/'tests/postgres16/stub.sql')
        deployment_text = (ROOT/'supabase/DEPLOY_TO_SUPABASE.sql').read_text(encoding='utf-8')
        guard = deployment_text.split('do $first_deployment_guard$',1)[1].split('end $first_deployment_guard$;',1)[0]
        guard = 'do $first_deployment_guard$' + guard + 'end $first_deployment_guard$;'
        try:
            sql(guard)
        except RuntimeError as error:
            if 'verified platform function public.rls_auto_enable() is missing' not in str(error):
                raise
            passed('platform guard rejects both missing function and missing trigger')
        else:
            raise AssertionError('Guard accepted absent platform function/trigger')
        # Trusted platform fixture from the verified backup, not from production.
        # Preserve LF exactly: the guard checks pg_get_functiondef without any
        # whitespace normalization and leaves the function/event trigger intact.
        file(ROOT/'tests/postgres17/fixtures/rls-auto-enable.sql')
        check('platform fingerprint algorithm is MD5(pg_get_functiondef)',"(select md5(pg_get_functiondef(oid))='846ec2fbff751d24b890656d63c3a9bf' and md5(prosrc)='c44fb229ea8a6b0afd04a0a33261c16c' from pg_proc where oid='public.rls_auto_enable()'::regprocedure)")
        deployment_text = (ROOT/'supabase/DEPLOY_TO_SUPABASE.sql').read_text(encoding='utf-8')
        guard = deployment_text.split('do $first_deployment_guard$',1)[1].split('end $first_deployment_guard$;',1)[0]
        guard = 'do $first_deployment_guard$' + guard + 'end $first_deployment_guard$;'
        sql(guard)
        passed('platform exact definition/owner/security/trigger accepted by actual generated guard')
        # PostgreSQL requires a superuser owner for EVENT TRIGGER objects; this
        # role exists only inside the disposable cluster, never in deployment SQL.
        sql('create role fixture_platform_owner superuser;')
        cases = [
            ('zero-argument function missing while trigger still exists','alter function public.rls_auto_enable() rename to fixture_saved_rls;'),
            ('changed definition',"create or replace function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$begin null;end$$;"),
            ('wrong function owner','alter function public.rls_auto_enable() owner to fixture_platform_owner;'),
            ('security invoker','alter function public.rls_auto_enable() security invoker;'),
            ('wrong language',"create language fixture_plpgsql handler pg_catalog.plpgsql_call_handler inline pg_catalog.plpgsql_inline_handler validator pg_catalog.plpgsql_validator;create or replace function public.rls_auto_enable() returns event_trigger language fixture_plpgsql security definer set search_path=pg_catalog as $$begin null;end$$;"),
            ('wrong search_path','alter function public.rls_auto_enable() set search_path=public;'),
            ('extra search_path entry','alter function public.rls_auto_enable() set search_path=pg_catalog,public;'),
            ('extra function setting',"alter function public.rls_auto_enable() set work_mem='8MB';"),
            ('trigger absent under required name','alter event trigger ensure_rls rename to fixture_saved_ensure;'),
            ('trigger disabled','alter event trigger ensure_rls disable;'),
            ('trigger enabled always','alter event trigger ensure_rls enable always;'),
            ('trigger replica mode','alter event trigger ensure_rls enable replica;'),
            ('wrong trigger owner','alter event trigger ensure_rls owner to fixture_platform_owner;'),
            ('wrong trigger event',"alter event trigger ensure_rls rename to fixture_saved_ensure; create event trigger ensure_rls on sql_drop execute function public.rls_auto_enable();"),
            ('wrong trigger tags',"alter event trigger ensure_rls rename to fixture_saved_ensure; create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE') execute function public.rls_auto_enable();"),
            ('wrong trigger function',"create function auth.fixture_event() returns event_trigger language plpgsql as $$begin null;end$$;alter event trigger ensure_rls rename to fixture_saved_ensure;create event trigger ensure_rls on ddl_command_end execute function auth.fixture_event();"),
            ('extra event trigger on verified function',"create event trigger fixture_additional_ensure on ddl_command_end execute function public.rls_auto_enable();"),
            ('additional unknown public function',"create function public.fixture_unknown() returns integer language sql as $$select 1$$;"),
            ('additional unknown support routine',"create schema if not exists support_private;create function support_private.fixture_unknown() returns integer language sql as $$select 1$$;"),
            ('overload with arguments',"create function public.rls_auto_enable(integer) returns integer language sql as $$select $1$$;"),
        ]
        for label, mutation in cases:
            try:
                sql('begin;'+mutation+guard+'rollback;')
            except RuntimeError as error:
                if 'First deployment refused:' not in str(error):
                    raise AssertionError('Mutation failed before reaching guard: '+label+': '+str(error))
                passed('platform guard rejects '+label)
            else:
                raise AssertionError('Guard accepted '+label)
        check('failed guard attempts retain original platform function',"md5(pg_get_functiondef('public.rls_auto_enable()'::regprocedure))='846ec2fbff751d24b890656d63c3a9bf'")
        check('failed guard attempts retain original enabled trigger',"exists(select 1 from pg_event_trigger where evtname='ensure_rls' and evtfoid='public.rls_auto_enable()'::regprocedure and evtenabled='O' and evtevent='ddl_command_end')")
        file(ROOT/'supabase/DEPLOY_TO_SUPABASE.sql')
        passed('complete DEPLOY_TO_SUPABASE.sql including postcommit verification')
        check('full deployment preserves platform function hash',"md5(pg_get_functiondef('public.rls_auto_enable()'::regprocedure))='846ec2fbff751d24b890656d63c3a9bf'")
        check('full deployment preserves platform event trigger',"exists(select 1 from pg_event_trigger where evtname='ensure_rls' and evtfoid='public.rls_auto_enable()'::regprocedure and evtenabled='O' and evtevent='ddl_command_end')")
        try:
            file(ROOT/'supabase/DEPLOY_TO_SUPABASE.sql')
            raise AssertionError('First-install reapplication was accepted')
        except RuntimeError as error:
            if 'Existing target relation' not in str(error):
                raise
            passed('first-install repeat refuses existing application without changes')
        check('single apply: messages.customer_id',"exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='customer_id')")
        check('single apply: anon table INSERT revoked',"not has_table_privilege('anon','public.messages','INSERT')")
        check('single apply: anon status INSERT denied',"not has_column_privilege('anon','public.messages','status','INSERT')")
        check('pgcrypto extensions schema',"exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto' and n.nspname='extensions')")
        file(ROOT/'supabase/setup.sql')
        passed('complete setup repeated apply')
        check('11 migration versions',"(select count(*) from public.store_schema_migrations)=11")
        for repetition in range(2):
            for migration in sorted((ROOT/'supabase/migrations').glob('*.sql')):
                file(migration)
                passed('individual pass '+str(repetition+1)+': '+migration.name)
        tables = 'store_schema_migrations profiles user_roles categories products bundles bundle_items customers orders order_items notifications settings support_messages product_images inventory_transactions message_replies payment_transactions provider_events shipments order_stock_reservations shipment_requests deleted_support_messages'.split()
        for table in tables:
            check(table+': exists',"to_regclass('public."+table+"') is not null")
            check(table+': RLS',"(select relrowsecurity from pg_class where oid='public."+table+"'::regclass)")
            check(table+': primary key',"exists(select 1 from pg_constraint where conrelid='public."+table+"'::regclass and contype='p')")
            check(table+': anon TRUNCATE denied',"not has_table_privilege('anon','public."+table+"','TRUNCATE')")
        for op in ['SELECT','UPDATE','DELETE']:
            check('anon view '+op+' denied',"not has_table_privilege('anon','public.messages','"+op+"')")
        for col in ['name','email','subject','order_number','product_name','message','consent']:
            check('anon view insert '+col,"has_column_privilege('anon','public.messages','"+col+"','INSERT')")
        for table in ['orders','customers','support_messages','payment_transactions','deleted_support_messages']:
            check('anon private read denied '+table,"not has_table_privilege('anon','public."+table+"','SELECT')")
        check('request ID unique',"exists(select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid='public.orders'::regclass and i.indisunique and a.attname='request_id')")
        check('demo delete policy removed',"not exists(select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='order_delete')")
        check('definers fixed search_path',"not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) c where c like 'search_path=%'))")
        for table in ['orders','products','bundles','support_messages','message_replies','customers','notifications','settings','payment_transactions','shipments','order_stock_reservations','shipment_requests','categories']:
            check('Realtime '+table,"exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='"+table+"')")
        for scenario in sorted((ROOT/'supabase/tests').glob('*.sql')):
            run('psql',*conn,'-c',"select set_config('almumez.test_isolated','yes',false)",'-f',scenario)
            passed('scenario: '+scenario.name)
        check('postcommit validation does not recreate schema',"to_regclass('public.public_products') is not null and to_regclass('public.public_bundles') is not null")
        sql("insert into public.products(id,published,payload) values('pg16-parallel',true,'{\"price\":100,\"stock\":10}')")
        order = {'id':'PG16-CONCURRENT-0','requestId':'c0110000-0000-4000-8000-000000000001','customer':{'name':'Parallel fixture','email':'parallel@fixture.invalid','phone':'01099998888','address':'Fixture street','city':'Cairo'},'items':[{'id':'pg16-parallel','quantity':2}],'subtotal':200,'shipping':0,'discount':0,'coupon':'','delivery':'standard','payment':'cod','language':'en'}
        def purchase(index):
            payload = dict(order, id='PG16-CONCURRENT-'+str(index))
            return sql("begin;set local role anon;select public.submit_store_order('"+json.dumps(payload).replace("'","''")+"'::jsonb);select pg_sleep(0.25);commit;")
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(purchase,n) for n in range(2)]
            for future in futures:
                future.result()
        check('parallel independent connections: one order',"(select count(*) from public.orders where request_id='c0110000-0000-4000-8000-000000000001')=1")
        check('parallel independent connections: one stock deduction',"(select (payload->>'stock')::int from public.products where id='pg16-parallel')=8")
        print('PASS',len(results),'checks on',version)
    except BaseException as error:
        failure = str(error)
        raise
    finally:
        if started:
            run('pg_ctl','-D',directory/'data','-m','fast','-w','stop')
        report = {'server':version,'disposable':True,'productionContacted':False,'passed':failure is None,'failure':failure,'checks':results,'note':'Auth/Storage fixtures only. Temporary cluster retained stopped for inspection.'}
        (ROOT/'docs/backend-audit/postgres17-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

if __name__ == '__main__':
    main()

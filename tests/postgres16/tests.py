"""Creates its own disposable PostgreSQL 16 cluster. Never accepts a DSN.
Usage: python tests/postgres16/tests.py --pg-bin /path/to/postgresql16/bin
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
    if ' 16.' not in version:
        raise RuntimeError('PostgreSQL 16 required: ' + version)
    directory = pathlib.Path(tempfile.mkdtemp(prefix='almumez-pg16-')).resolve()
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
        file(ROOT/'supabase/setup.sql')
        passed('complete setup first apply')
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
        for table in ['orders','support_messages']:
            check('Realtime '+table,"exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='"+table+"')")
        for scenario in sorted((ROOT/'supabase/tests').glob('*.sql')):
            run('psql',*conn,'-c',"select set_config('almumez.test_isolated','yes',false)",'-f',scenario)
            passed('scenario: '+scenario.name)
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
        (ROOT/'docs/backend-audit/postgres16-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

if __name__ == '__main__':
    main()

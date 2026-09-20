import {test,expect} from '@playwright/test';
import {recordAudit} from '../src/lib/audit';

function fakeClient(error:any=null){
 const rows:any[]=[];
 return {rows,client:{from(table:string){return{insert:async(value:any)=>{rows.push({table,value});return{error};}};}} as any};
}

test('an audit entry is written with actor, action and target',async()=>{
 const {rows,client}=fakeClient();
 await recordAudit(client,{actor:'admin@example.com',action:'wall.delete',targetTable:'social_posts',targetId:'post-1',detail:{author:'Aina'}});
 expect(rows).toHaveLength(1);
 expect(rows[0].table).toBe('admin_audit_log');
 expect(rows[0].value).toMatchObject({actor:'admin@example.com',action:'wall.delete',target_table:'social_posts',target_id:'post-1',detail:{author:'Aina'}});
});

test('a failed audit write throws so the caller cannot report success',async()=>{
 const {client}=fakeClient({message:'nope'});
 await expect(recordAudit(client,{actor:'a@b.com',action:'wall.delete',targetTable:'social_posts',targetId:'post-1'})).rejects.toThrow();
});

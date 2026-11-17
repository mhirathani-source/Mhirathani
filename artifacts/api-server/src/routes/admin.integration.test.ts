import {strict as assert} from "node:assert";
import {test,after} from "node:test";
import express from "express";
import {randomUUID} from "node:crypto";
import {once} from "node:events";
import {eq,inArray} from "drizzle-orm";
import {db,pool,clubUsersTable,clubBackupsTable,rolePermissionsTable,rolesTable} from "@workspace/db";
import adminRouter from "./admin";
import {financialAccess} from "../middlewares/financialAccess";
import {MembershipError} from "../lib/membership";

after(()=>pool.end());
// Authentication is covered by the real Clerk browser journey. This isolated
// HTTP harness tests authorized handler behavior, not a production auth bypass.
test("owner role CRUD and encrypted backup HTTP handlers use real PostgreSQL", {skip:process.env.NODE_ENV==="production"},async()=>{
  const [owner]=await db.select().from(clubUsersTable).where(eq(clubUsersTable.isOwner,true));
  assert.ok(owner);
  const name=`test_${randomUUID().replaceAll("-","").slice(0,12)}`;
  const backups:number[]=[];
  let userId:number|undefined;
  const app=express();app.use(express.json({limit:"13mb"}));
  app.use((req,_res,next)=>{req.clubUser=req.headers["x-test-staff"]?{...owner,isOwner:false,role:"staff"}:owner;req.clubPermissions=[];next();});
  app.use(financialAccess,adminRouter);
  app.use(((error, _req,res,_next)=>{res.status(error instanceof MembershipError?error.status:500).json({error:error.message});}) as express.ErrorRequestHandler);
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");
  const address=server.address();assert.ok(address&&typeof address!=="string");
  const port=address.port;
  async function call(path:string,method="GET",body?:unknown,staff=false){
    return fetch(`http://127.0.0.1:${port}/club/admin${path}`,{method,headers:{"Content-Type":"application/json",...(staff?{"x-test-staff":"1"}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  }
  try{
    assert.equal((await call("/whatsapp-reminders","GET",undefined,true)).status,403);
    const reminders=await(await call("/whatsapp-reminders")).json() as {enabled:boolean;configured:boolean;mode:string};
    assert.deepEqual(reminders,{enabled:false,configured:false,mode:"manual"});
    assert.equal((await call("/whatsapp-reminders","PUT",{enabled:true})).status,409);
    assert.deepEqual(await(await call("/whatsapp-reminders")).json(),{enabled:false,configured:false,mode:"manual"});
    assert.equal((await call("/roles","GET",undefined,true)).status,403);
    assert.equal((await call("/roles","POST",{name,label:"اختبار دور مؤقت",permissions:["members.view"]})).status,201);
    const listing=await(await call("/roles")).json() as {roles:{name:string;permissions:string[]}[]};
    assert.ok(listing.roles.find((r:{name:string})=>r.name===name)?.permissions.includes("members.view"));
    assert.equal((await call(`/roles/${name}`,"PATCH",{permissions:["members.view","reports.view"]})).status,200);
    const [fixture]=await db.insert(clubUsersTable).values({clerkUserId:`test:${name}`,email:`${name}@example.invalid`,role:name,status:"pending"}).returning();
    userId=fixture.id;
    assert.equal((await call(`/users/${userId}`,"PATCH",{role:"missing_test_role"})).status,400);
    const [unchanged]=await db.select().from(clubUsersTable).where(eq(clubUsersTable.id,userId));
    assert.equal(unchanged.role,name);
    assert.equal((await call(`/roles/${name}`,"DELETE")).status,409);
    await db.delete(clubUsersTable).where(eq(clubUsersTable.id,userId));userId=undefined;
    assert.equal((await call(`/roles/${name}`,"DELETE")).status,204);
    const createdResponse=await call("/backups","POST",{label:"HTTP integration selftest"});assert.equal(createdResponse.status,201);
    const entry=await createdResponse.json() as {id:number};backups.push(entry.id);
    assert.equal((await call(`/backups/${entry.id}/file`,"GET",undefined,true)).status,403);
    const download=await call(`/backups/${entry.id}/file`);assert.equal(download.status,200);
    const encrypted=await download.text();assert.equal(JSON.parse(encrypted).algorithm,"AES-256-GCM");
    const imported=await call("/backups/import","POST",{file:encrypted});assert.equal(imported.status,201);backups.push((await imported.json() as {id:number}).id);
    const previewResponse=await call(`/backups/${entry.id}/preview`,"POST");assert.equal(previewResponse.status,200);
    const preview=await previewResponse.json() as {token:string};assert.equal(preview.token.length,64);
    assert.equal((await call(`/backups/${entry.id}/restore`,"POST",{token:preview.token,confirmation:"wrong"})).status,400);
  }finally{
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    if(userId)await db.delete(clubUsersTable).where(eq(clubUsersTable.id,userId));
    await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleName,name));
    await db.delete(rolesTable).where(eq(rolesTable.name,name));
    if(backups.length)await db.delete(clubBackupsTable).where(inArray(clubBackupsTable.id,backups));
  }
});

import {strict as assert} from "node:assert";
import {after,test} from "node:test";
import {randomUUID} from "node:crypto";
import {eq,sql} from "drizzle-orm";
import {db,pool,clubUsersTable,rolesTable,systemSettingsTable} from "@workspace/db";
import {initializeAccessModelInTransaction} from "./accessSetup";

after(()=>pool.end());

test("schema-only publish preserves legacy accounts and never approves later signups", {skip:process.env.NODE_ENV==="production"},async()=>{
  const rollback=new Error("rollback isolated access initialization test");
  const schema=sql.identifier(`access_test_${randomUUID().replaceAll("-","")}`);
  try {
    await db.transaction(async trx=>{
      await trx.execute(sql`CREATE SCHEMA ${schema}`);
      await trx.execute(sql`SET LOCAL search_path TO ${schema}`);
      // Clone the schema only; no real accounts or financial rows are modified.
      for(const name of ["club_users","club_roles","club_permissions","club_role_permissions","system_settings","audit_log"]){
        await trx.execute(sql`CREATE TABLE ${sql.identifier(name)} (LIKE ${sql.identifier("public")}.${sql.identifier(name)} INCLUDING ALL)`);
      }
      await trx.insert(clubUsersTable).values([
        {id:-1,clerkUserId:"legacy_owner",email:"owner@example.invalid",role:"admin"},
        {id:-2,clerkUserId:"legacy_staff",email:"staff@example.invalid",role:"staff"},
      ]);
      await trx.execute(sql`INSERT INTO audit_log(id,actor_id,action,entity_type) VALUES(-1,'legacy_owner','auth.owner_initialized','club_user')`);
      assert.equal((await trx.select().from(rolesTable)).length,0);
      await initializeAccessModelInTransaction(trx);
      const [owner]=await trx.select().from(clubUsersTable).where(eq(clubUsersTable.id,-1));
      assert.equal(owner.status,"active");assert.equal(owner.isOwner,true);
      assert.equal(owner.permissionOverrides["reports.view"],true);
      const [staff]=await trx.select().from(clubUsersTable).where(eq(clubUsersTable.id,-2));
      assert.equal(staff.status,"active");assert.deepEqual(staff.permissionOverrides,{});
      assert.equal((await trx.select().from(rolesTable)).length,4);
      await trx.insert(clubUsersTable).values({id:-3,clerkUserId:"later_signup",email:"new@example.invalid",role:"staff"});
      await trx.update(clubUsersTable).set({status:"suspended"}).where(eq(clubUsersTable.id,-2));
      await initializeAccessModelInTransaction(trx);
      const [pending]=await trx.select().from(clubUsersTable).where(eq(clubUsersTable.id,-3));
      assert.equal(pending.status,"pending");assert.deepEqual(pending.permissionOverrides,{});
      const [suspended]=await trx.select().from(clubUsersTable).where(eq(clubUsersTable.id,-2));
      assert.equal(suspended.status,"suspended");
      assert.equal((await trx.select().from(systemSettingsTable).where(eq(systemSettingsTable.key,"access_model.v1"))).length,1);
      throw rollback;
    });
  }catch(error){if(error!==rollback)throw error;}
});

import {strict as assert} from "node:assert";
import {test} from "node:test";
import type {Request,Response} from "express";
import {financialAccess} from "./financialAccess";
import {routePermissions} from "../lib/permissions";

function allowed(path:string,method="GET",permissions:string[]=[],extra:Record<string,unknown>={},query:Record<string,string>={}){
  let yes=false,status=200;
  financialAccess({method,path,query,clubUser:{role:"staff",status:"active",isOwner:false,...extra},clubPermissions:permissions,body:{role:"admin",isOwner:true},headers:{"x-role":"admin"}} as unknown as Request,
    {status(code:number){status=code;return this;},json(){}} as unknown as Response,()=>{yes=true;});
  return {yes,status};
}
test("unknown and all ungranted financial endpoints deny client supplied roles",()=>{
  for(const path of ["/finance/transactions","/finance/categories","/finance/cash","/finance/reports","/club/finance/report","/club/employees","/club/payroll","/plans","/subscriptions","/payments/1/receipt","/reports","/revenue","/expenses","/memberships/financials","/future-export"])
    for(const method of ["GET","HEAD","POST","PATCH","PUT","DELETE"])assert.deepEqual(allowed(path,method),{yes:false,status:403},`${method} ${path}`);
});
test("admin label does not confer money or owner-control access",()=>{
  assert.equal(allowed("/finance/transactions","GET",[],{role:"admin"}).yes,false);
  assert.equal(allowed("/club/admin/users","GET",["users.view","users.approve"],{role:"admin"}).yes,false);
  assert.equal(allowed("/club/admin/backups","GET",["backups.view"]).yes,false);
});
test("owner retains all access, but inactive accounts are denied",()=>{
  assert.equal(allowed("/finance/transactions","GET",[],{isOwner:true}).yes,true);
  assert.equal(allowed("/club/admin/users","PATCH",[],{isOwner:true}).yes,true);
  for(const status of ["pending","rejected","suspended"])assert.equal(allowed("/finance/transactions","GET",["finance.view"],{isOwner:true,status}).yes,false);
});
test("financial view, edit and payroll disbursement are distinct grants",()=>{
  assert.equal(allowed("/club/dashboard","GET",["dashboard.view","members.view","payments.view"]).yes,false);
  assert.equal(allowed("/club/dashboard","GET",["dashboard.view","members.view","payments.view","reports.view"]).yes,true);
  assert.equal(allowed("/finance/transactions","GET",["finance.view"]).yes,true);
  assert.equal(allowed("/finance/transactions","POST",["finance.view"]).yes,false);
  assert.equal(allowed("/finance/transactions/1","PATCH",["finance.edit"]).yes,true);
  assert.equal(allowed("/finance/payroll/1/payments","POST",["payroll.edit"]).yes,false);
  assert.equal(allowed("/finance/payroll/1/payments","POST",["payroll.approve"]).yes,true);
  assert.equal(allowed("/finance/employees","GET",["finance.view"]).yes,false);
});
test("view-only reports cannot export, even via query parameter",()=>{
  assert.equal(allowed("/finance/reports","GET",["reports.view"]).yes,true);
  assert.equal(allowed("/finance/reports","GET",["reports.view"],{}, {format:"csv"}).yes,false);
  assert.equal(allowed("/finance/reports","GET",["reports.view","reports.export"],{}, {format:"csv"}).yes,true);
  assert.equal(allowed("/club/exports/members","GET",["members.view"]).yes,false);
  assert.equal(allowed("/club/exports/members","GET",["members.view","members.export"]).yes,true);
});
test("operational subscription APIs are separate from money-bearing APIs",()=>{
  assert.deepEqual(routePermissions("GET","/club/operations/subscriptions"),["subscriptions.view"]);
  assert.equal(allowed("/club/operations/subscriptions","GET",["subscriptions.view"]).yes,true);
  assert.equal(allowed("/subscriptions","GET",["subscriptions.view"]).yes,false);
  assert.equal(allowed("/members/1/profile","GET",["members.view"]).yes,true);
  assert.equal(allowed("/members/1","GET",["members.view"]).yes,false);
  assert.equal(allowed("/members","POST",["members.view"]).yes,false);
  assert.equal(allowed("/members","POST",["members.create"]).yes,true);
});

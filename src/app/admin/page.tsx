"use client";
import {useEffect} from "react";
import {useAdminNavigation} from "@/components/admin/AdminLink";
import {LoadingSkeleton} from "@/components/admin/LoadingSkeleton";
export default function AdminHomePage(){
 const navigation=useAdminNavigation();
 useEffect(()=>{
  const controller=new AbortController();
  void fetch("/api/admin/get-started",{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error("Progress unavailable");
   const progress=await response.json();
   navigation.replace(progress.steps?.some((step:{id:string;complete:boolean})=>step.id==="result"&&step.complete)?"/admin/today":"/admin/get-started");
  }).catch(()=>{if(!controller.signal.aborted)navigation.replace("/admin/get-started");});
  return()=>controller.abort();
 },[navigation]);
 return <LoadingSkeleton variant="page"/>;
}

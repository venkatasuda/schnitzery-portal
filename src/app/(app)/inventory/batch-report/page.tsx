import BatchReportClient from "./BatchReportClient";
import {getInventoryBatchReport} from "@/lib/queries/inventory-batch-report";
export default async function Page(){
 const initial=await getInventoryBatchReport().catch(()=>({ok:false as const,error:"load"}));
 return <BatchReportClient key={initial.ok?initial.branchId:"denied"} initial={initial}/>;
}

import ConnectionsClient from "./ConnectionsClient";
import {getPosPipeline} from "@/lib/queries/pos-pipeline";
export default async function Page(){
 const initial=await getPosPipeline().catch(()=>({ok:false as const,error:"load"}));
 return <ConnectionsClient key={initial.ok?initial.branchId:"denied"} initial={initial}/>;
}

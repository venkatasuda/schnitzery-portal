import PosWorkspace from "@/components/integrations/PosWorkspace";
import {getPosPipeline} from "@/lib/queries/pos-pipeline";
export default async function Page(){
 const initial=await getPosPipeline().catch(()=>({ok:false as const,error:"load"}));
 return <PosWorkspace key={initial.ok?initial.branchId:"denied"} initial={initial} section="connections"/>;
}

import {createClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
import {validPosDaily,verifyPosSignature} from "@/lib/sales/pos-ingest";
import {berlinToday} from "@/lib/time/berlinDate";
import {uuid} from "@/lib/inventory/operations";
export const runtime="nodejs";
export async function POST(request:Request){
 const id=request.headers.get("x-pos-connection"),timestamp=request.headers.get("x-pos-timestamp")??"",signature=request.headers.get("x-pos-signature")??"";
 if(!uuid(id))return NextResponse.json({error:"Unauthorized"},{status:401});
 let secret:unknown;try{secret=JSON.parse(process.env.POS_INGEST_KEYS??"{}")[id];}catch{return NextResponse.json({error:"Connector unavailable"},{status:503});}
 if(typeof secret!=="string"||secret.length<32)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!request.body)return NextResponse.json({error:"Payload required"},{status:400});
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1_000_000){await reader.cancel();return NextResponse.json({error:"Payload too large"},{status:413});}chunks.push(value);}}catch{return NextResponse.json({error:"Invalid payload"},{status:400});}
 const body=Buffer.concat(chunks).toString("utf8");
 if(!verifyPosSignature(body,timestamp,signature,secret))return NextResponse.json({error:"Unauthorized"},{status:401});
 let payload:unknown;try{payload=JSON.parse(body);}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 if(!validPosDaily(payload,berlinToday()))return NextResponse.json({error:"Invalid normalized daily totals"},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:"Connector unavailable"},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc("stage_pos_import",{p_connection:id,p_payload:payload});
 if(error)return NextResponse.json({error:error.code==="23505"?"External ID conflict":"Import not accepted"},{status:error.code==="23505"?409:400});
 return NextResponse.json({id:data,status:"received"},{status:202});
}

import { expect,it } from "vitest";
import { ingredientPrice,parsePriceImport,validPriceBody,type PriceVersion } from "./prices";
const product={id:"product",product:"Ingredient",category:"Test",unit:"kg"};
const quote=(date:string,price:number,revision=1)=>({product_id:"product",...product,id:"version",effective_date:date,net_unit_price:price,revision}) as PriceVersion;
it("uses newer reviewed reference prices for estimates, preferring actual deliveries on a tie",()=>{
 const purchases=[{purchase_date:"2026-10-01",qty:2,cost:8},{purchase_date:"2026-10-01",qty:2,cost:12}];
 expect(ingredientPrice(product,purchases,[quote("2026-10-01",3)],"2026-10-02")).toMatchObject({price:5,price_kind:"receipt"});
 expect(ingredientPrice(product,purchases,[quote("2026-10-02",6)],"2026-10-02")).toMatchObject({price:6,price_kind:"reference"});
 expect(ingredientPrice(product,purchases,[quote("2026-10-03",100)],"2026-10-02").price).toBe(5);
 expect(ingredientPrice(product,[],[quote("2026-10-01",3),quote("2026-10-01",4,2)],"2026-10-02").price).toBe(4);
 expect(ingredientPrice(product,[],[{...quote("2026-10-01",3),unit:"l"}],"2026-10-02").price).toBeNull();
});
it("retains unknown imported values and rejects malformed reference files",()=>{
 const row={item:"Ingredient",source:"Undated supplier list",article_no:"",pack_size:"Unknown",bought_quantity:"",quote_qty:null,quote_unit:null,price:null,basis:null,vat_pct:null,observed_date:null,kind:"manual",line_total:null,notes:"Verify actual pack and price"};
 expect(parsePriceImport(JSON.stringify({format:"schnitzery-price-reference-v1",rows:[row]}))?.[0].price).toBeNull();
 expect(parsePriceImport(JSON.stringify({format:"schnitzery-price-reference-v1",rows:[{...row,price:-1}]}))).toBeNull();
 expect(parsePriceImport("not JSON")).toBeNull();
});
it("requires a reviewed effective date, explicit price and tax basis",()=>{
 const body={pack_qty:10,pack_price:20,basis:"net",vat_pct:null,effective_date:"2026-10-01",source:"Supplier quote",source_type:"supplier_quote",note:"Confirmed pack",reference_import_id:null,reference_index:null,reviewed:true};
 expect(validPriceBody(body)).toBe(true);expect(validPriceBody({...body,pack_price:0})).toBe(true);
 expect(validPriceBody({...body,pack_price:null})).toBe(false);expect(validPriceBody({...body,basis:"gross"})).toBe(false);expect(validPriceBody({...body,effective_date:""})).toBe(false);expect(validPriceBody({...body,reviewed:false})).toBe(false);
});

const fs=require('node:fs');
const check=require('./receiving-batches.cjs');
check(async db=>{
 await db.exec(`reset role;create table auth.users(id uuid primary key,email text);alter table inventory_counts add column created_at timestamptz default now(),add column count_date date default current_date;`);
 for(const file of ['20261101074231_inventory_recipe_costing.sql','20261101125825_inventory_recipe_retry_conflict.sql','20261103102620_inventory_recipe_optional_selling_price.sql','20261104190000_inventory_price_versions.sql','20261105162633_inventory_lot_transfers.sql','20261105163333_inventory_pos_recipe_consumption.sql','20261105163337_inventory_valuation_closes.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 for(const name of ['inventory_lot_transfers.sql','inventory_pos_stock.sql','inventory_valuation_closes.sql'])await db.exec(fs.readFileSync('supabase/tests/'+name,'utf8').replace(/^\\set.*$/gm,''));
 console.log('Advanced inventory: lot transfers, POS recipe depletion/reversal and immutable net valuation SQL acceptance passed.');
}).catch(error=>{console.error(error.message);process.exitCode=1;});

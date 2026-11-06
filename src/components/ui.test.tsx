import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {Field} from "./ui";
it("keeps a dropdown's accessible label independent of its option text and preserves explicit labels",()=>{
 expect(renderToStaticMarkup(<Field label="Connection"><select><option>Synthetic till</option></select></Field>)).toContain('aria-label="Connection"');
 expect(renderToStaticMarkup(<Field label="Quantity"><input aria-label="Quantity in kg"/></Field>)).toContain('aria-label="Quantity in kg"');
 expect(renderToStaticMarkup(<Field label="Grouped"><div><input aria-label="First"/></div></Field>)).toContain('aria-label="First"');
});

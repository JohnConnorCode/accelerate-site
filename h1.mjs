import { chromium } from "playwright";
const b = await chromium.launch();
for (const [u,label] of [["services","/services"],["about","/about"],["industries/professional-services","/industries/professional-services"]]) {
  const p = await b.newPage({viewport:{width:1440,height:900}});
  await p.goto(`http://localhost:3200/${u}`,{waitUntil:"networkidle",timeout:90000});
  await p.waitForTimeout(900);
  const h1 = await p.evaluate(()=>document.querySelector("h1")?.innerText.replace(/\s+/g," ").trim());
  console.log(label.padEnd(36), JSON.stringify(h1));
  await p.close();
}
await b.close();

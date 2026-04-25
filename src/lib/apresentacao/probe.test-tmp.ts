import pptxgen from 'pptxgenjs';
async function main() {
  const p = new pptxgen();
  const s = p.addSlide();
  s.addText('hi', { x:1, y:1, w:3, h:1 });
  const out:any = await (p as any).write({ outputType: 'arraybuffer' });
  console.error('typeof', typeof out, 'ctor', out?.constructor?.name, 'len', out?.byteLength ?? out?.length);
  const out2:any = await (p as any).write({ outputType: 'nodebuffer' });
  console.error('nodebuffer typeof', typeof out2, 'ctor', out2?.constructor?.name, 'len', out2?.byteLength ?? out2?.length);
}
main();

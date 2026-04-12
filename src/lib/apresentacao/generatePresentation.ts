import JSZip from 'jszip';
import { APRESENTACAO_SLIDES_MAP } from './slideDefinitions';
import { buildAutomaticComment } from './commentRules';
import type { ApresentacaoDataBundle, SlideCodigo, SlideData } from '@/types/apresentacao';
import { pickEditedComment } from './utils';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function contentTypes(slideCount: number): string {
  const slideOverrides = Array.from({ length: slideCount }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}</Types>`;
}

function slideXml(title: string, subtitle: string, comment: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="304800"/><a:ext cx="8229600" cy="914400"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="3400" b="1"/><a:t>${esc(title)}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1371600"/><a:ext cx="8229600" cy="762000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1800"/><a:t>${esc(subtitle)}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Comment"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="2362200"/><a:ext cx="8229600" cy="2743200"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1600"/><a:t>${esc(comment)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function baseXml(slideCount: number): Record<string, string> {
  const slideEntries = Array.from({ length: slideCount }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  const relEntries = Array.from({ length: slideCount }, (_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');
  return {
    '[Content_Types].xml': contentTypes(slideCount),
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>AviZee ERP</Application></Properties>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Apresentação Gerencial</dc:title></cp:coreProperties>`,
    'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideEntries}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${relEntries}</Relationships>`,
    'ppt/slideMasters/slideMaster1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
    'ppt/slideLayouts/slideLayout1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`,
    'ppt/theme/theme1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="AviZee"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1></a:clrScheme><a:fontScheme name="AviZee"><a:majorFont><a:latin typeface="Calibri"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"/></a:themeElements></a:theme>`,
  };
}

export async function generatePresentation(
  data: ApresentacaoDataBundle,
  comentariosEditados: Partial<Record<string, string>>,
  options?: { slideOrder?: SlideCodigo[]; metadata?: Record<string, unknown> },
): Promise<Blob> {
  const order = options?.slideOrder?.length ? options.slideOrder : (Object.keys(data.slides) as SlideCodigo[]);

  const slides: SlideData[] = order.map((codigo) => {
    const def = APRESENTACAO_SLIDES_MAP.get(codigo);
    const dadosSlide = data.slides[codigo] ?? {};
    return {
      codigo,
      titulo: def?.titulo ?? codigo,
      subtitulo: def?.subtitulo ?? '',
      dados: dadosSlide,
      comentarioAutomatico: buildAutomaticComment(codigo, dadosSlide),
      comentarioEditado: comentariosEditados[codigo],
      indisponivel: Boolean(dadosSlide.indisponivel),
    };
  });

  const metadataText = options?.metadata ? JSON.stringify(options.metadata) : '';
  const zip = new JSZip();
  const files = baseXml(slides.length);
  Object.entries(files).forEach(([path, content]) => zip.file(path, content));

  slides.forEach((slide, index) => {
    const comment = pickEditedComment(slide.comentarioAutomatico, slide.comentarioEditado);
    const detail = slide.indisponivel
      ? `${comment} (dados indisponíveis nesta fase)`
      : `${comment} | Base: ${Object.keys(slide.dados).slice(0, 5).join(', ') || 'sem campos'}`;
    const merged = slide.codigo === 'closing' ? `${detail} | metadata: ${metadataText}` : detail;
    zip.file(`ppt/slides/slide${index + 1}.xml`, slideXml(slide.titulo, slide.subtitulo ?? '', merged));
  });

  return zip.generateAsync({ type: 'blob' });
}

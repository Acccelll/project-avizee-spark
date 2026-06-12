## Objetivo
Fazer a leitura de código de barras (CODE-128 do DANFE) e QR Code (NFC-e) funcionar de fato nos modos **Câmera ao vivo** e **Tirar foto** da NF de Entrada. Manter intactos os modos Digitar e Upload (que já funcionam) e a interface do dialog.

## Diagnóstico

`src/pages/fiscal/hooks/useQrScanner.ts` hoje:

- Em **câmera ao vivo** decodifica apenas via ZXing varrendo frames do elemento `<video>` na resolução do preview (640–1280 px). Para CODE-128 de 44 dígitos do DANFE essa resolução é insuficiente — câmera abre, mas o callback de detecção nunca dispara.
- Em **Tirar foto** (com câmera já ativa) usa `canvas.drawImage(video)` em `video.videoWidth/Height` — captura o mesmo frame do preview, não uma foto em resolução de sensor. Resultado idêntico ao live: nada detectado.
- Nunca tenta `window.BarcodeDetector` (suportado em Chrome Android e Edge), que decodifica CODE-128 em tempo real com a câmera traseira.
- Não pede `focusMode: continuous` nem ajusta zoom; sem ROI no centro.

Os caminhos **Digitar/colar** e **Upload de imagem** continuam funcionando — não serão alterados.

## Mudanças

Editar **um único arquivo**: `src/pages/fiscal/hooks/useQrScanner.ts`.

### 1. Detector híbrido em camadas
Criar uma função interna `decodificarBitmapOuVideo(source, formats)` que tenta, nesta ordem:
1. `window.BarcodeDetector` se existir e listar `code_128` / `qr_code` em `getSupportedFormats()` — passar `ImageBitmap`/`HTMLVideoElement`.
2. ZXing (`BrowserMultiFormatReader.decodeFromImageElement` / `decodeFromCanvas`) como fallback.

Centralizar para que **live**, **tirar foto** e **upload** usem o mesmo pipeline e a mesma normalização de retorno (`text`).

### 2. Câmera ao vivo
- Em `iniciarCamera`, após `getUserMedia`, pedir `track.applyConstraints({ advanced: [{ focusMode: "continuous" }] })` (try/catch silencioso — nem todo device suporta).
- Subir `width/height` para `{ ideal: 2560, min: 1280 }` para aumentar a chance de decode em CODE-128.
- Substituir o loop `reader.decodeFromStream` por:
  - **Se BarcodeDetector disponível**: `requestAnimationFrame` chamando `detector.detect(video)` a cada ~200 ms. Ao retornar resultado, parar e disparar `onDetect`.
  - **Senão**: manter ZXing `decodeFromStream` (comportamento atual), com `tryHarder` e `delayBetweenScanAttempts: 120`.
- Ambos respeitam `IScannerControls`-like (`stop`) já usado pelo `pararCamera`.

### 3. Tirar foto (câmera ativa)
Reescrever `tirarFoto`:
1. Pegar a `MediaStreamTrack` ativa.
2. Se `ImageCapture` existir: `new ImageCapture(track).takePhoto()` → `Blob` → `createImageBitmap(blob)` (resolução de foto, alta).
3. Fallback: `imageCapture.grabFrame()` (já melhor que `videoWidth`) → `ImageBitmap`.
4. Fallback final: canvas a partir de `video` (comportamento atual) usando `track.getSettings().width/height` quando disponível.
5. Passar o resultado pelo detector híbrido. Em sucesso, parar câmera + `onDetect`; em falha, mensagem específica orientando aproximar e manter paralelo.

### 4. Upload de imagem
Reusar o mesmo detector híbrido (`decodeFromImageUrl` → `createImageBitmap` + BarcodeDetector quando disponível, ZXing como fallback). Mantém comportamento mas melhora taxa de leitura em fotos de DANFE.

### 5. Mensagens e UX
- Manter assinatura/contrato exportado de `useQrScanner` — `FiscalChaveScannerDialog` não precisa mudar.
- Erros: distinguir "câmera não suporta foto em alta resolução" (informativo, ainda tenta canvas) de "decoder não reconheceu" (acionável).

## Fora de escopo
- Alterar `FiscalChaveScannerDialog.tsx` (UI), `chaveAcesso.parser.ts` ou tipos.
- Tocar em backend, RLS, edge functions, fluxo de sincronização SEFAZ.
- Suporte a PDF direto (continua exigindo print).
- Tornar o app PWA/Capacitor.

## Validação
1. Live preview no desktop (sem BarcodeDetector): câmera abre, ZXing decodifica QR de NFC-e e DANFE quando aproximado.
2. Chrome Android (com BarcodeDetector): live decodifica CODE-128 do DANFE a ~20 cm.
3. iPhone Safari (sem BarcodeDetector e sem ImageCapture): "Tirar foto" cai no canvas e usa ZXing — segue funcional para QR; orientar uso de "Imagem" como reserva para CODE-128.
4. Upload de print PNG do DANFE: decodifica como antes ou melhor.
5. Rodar `bunx vitest run src/services/fiscal/__tests__/chaveAcesso.parser.test.ts` para garantir que o parser de chave (consumidor final) não regrediu.

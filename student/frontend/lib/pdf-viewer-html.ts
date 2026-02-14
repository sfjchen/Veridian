/**
 * Minimal PDF viewer HTML for use inside a WebView.
 *
 * Uses pdf.js from CDN to render a single page at a time.
 * Exposes window.loadPdfPage(base64, pageNum) for the native side
 * and posts messages back via window.ReactNativeWebView.postMessage:
 *   { type: 'totalPages', totalPages: number }
 *   { type: 'error', message: string }
 */
export const PDF_VIEWER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f3f4f6; display: flex; justify-content: center; padding: 8px; }
  canvas { max-width: 100%; height: auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.12); }
  .error { color: #dc2626; font-family: sans-serif; padding: 24px; text-align: center; }
</style>
</head>
<body>
<canvas id="pdf-canvas"></canvas>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  var pdfDoc = null;
  var canvas = document.getElementById('pdf-canvas');
  var ctx = canvas.getContext('2d');

  function postMsg(obj) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  }

  function renderPage(num) {
    if (!pdfDoc) return;
    pdfDoc.getPage(num).then(function(page) {
      var scale = 2;
      var viewport = page.getViewport({ scale: scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvasContext: ctx, viewport: viewport });
    }).catch(function(err) {
      postMsg({ type: 'error', message: 'Failed to render page: ' + err.message });
    });
  }

  window.loadPdfPage = function(base64, pageNum) {
    try {
      var raw = atob(base64);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      pdfjsLib.getDocument({ data: bytes }).promise.then(function(pdf) {
        pdfDoc = pdf;
        postMsg({ type: 'totalPages', totalPages: pdf.numPages });
        renderPage(pageNum || 1);
      }).catch(function(err) {
        postMsg({ type: 'error', message: 'Failed to load PDF: ' + err.message });
      });
    } catch (err) {
      postMsg({ type: 'error', message: 'Failed to decode PDF: ' + err.message });
    }
  };
</script>
</body>
</html>`;

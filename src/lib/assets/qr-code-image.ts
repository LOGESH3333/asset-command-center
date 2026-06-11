import QRCode from 'qrcode';
import type { AssetQrDisplayMeta } from './qr-code';

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  width: 320,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: {
    dark: '#0a0a0f',
    light: '#ffffff',
  },
};

export async function generateAssetQrDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, QR_OPTIONS);
}

export function downloadQrPng(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function printAssetQrLabel(options: {
  dataUrl: string;
  meta: AssetQrDisplayMeta;
  companyName?: string;
}) {
  const { dataUrl, meta, companyName = 'Asset Command Center' } = options;
  const win = window.open('', '_blank', 'width=480,height=640');
  if (!win) return;

  const shortUrl = meta.verificationUrl.replace(/^https?:\/\//, '');

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QR Label — ${meta.tag}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f4f4f5;
      padding: 16px;
    }
    .label {
      width: 2.25in;
      min-height: 2.25in;
      background: #fff;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .brand {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #7c3aed;
      margin-bottom: 6px;
    }
    img { width: 1.35in; height: 1.35in; display: block; margin: 0 auto 8px; }
    .name {
      font-size: 11px;
      font-weight: 700;
      color: #18181b;
      line-height: 1.3;
      margin-bottom: 4px;
      word-break: break-word;
    }
    .meta {
      font-size: 9px;
      color: #52525b;
      line-height: 1.5;
      font-family: ui-monospace, monospace;
    }
    .scan {
      font-size: 7px;
      color: #7c3aed;
      margin-top: 6px;
      word-break: break-all;
      line-height: 1.4;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .label { box-shadow: none; border: none; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="brand">${escapeHtml(companyName)}</div>
    <img src="${dataUrl}" alt="Asset QR" />
    <div class="name">${escapeHtml(meta.name)}</div>
    <div class="meta">Tag: ${escapeHtml(meta.tag)}</div>
    <div class="meta">Serial: ${escapeHtml(meta.serial)}</div>
    <div class="scan">Scan to verify → ${escapeHtml(shortUrl)}</div>
  </div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
</body>
</html>`);
  win.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

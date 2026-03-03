// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

// D-C1: Safe QR rendering via Canvas (replaces innerHTML SVG injection)

import { createEffect, onCleanup } from 'solid-js';
import QRCode from 'qrcode';

interface QRCanvasProps {
  data: string;
  size?: number;
  /** Accessible description for the QR code (e.g., "QR code for contact exchange") */
  description?: string;
}

/**
 * Renders a QR code to a Canvas element using the qrcode library.
 * This avoids innerHTML/SVG injection (XSS vector) by rendering directly
 * to the Canvas 2D context.
 */
export default function QRCanvas(props: QRCanvasProps) {
  let canvasRef: HTMLCanvasElement | undefined;

  createEffect(() => {
    const data = props.data;
    const size = props.size ?? 256;

    if (!canvasRef || !data) return;

    QRCode.toCanvas(canvasRef, data, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    }).catch((err: Error) => {
      console.error('QR render failed:', err);
    });
  });

  onCleanup(() => {
    // Clear canvas on unmount
    if (canvasRef) {
      const ctx = canvasRef.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    }
  });

  return <canvas ref={canvasRef} class="qr-canvas" role="img" aria-label={props.description ?? "QR code"} />;
}

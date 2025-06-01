// Polyfills para APIs do browser no ambiente Node.js
// Este arquivo deve ser importado ANTES de qualquer uso do pdfjs-dist

if (typeof globalThis !== 'undefined') {
  // Polyfill para DOMMatrix
  if (typeof globalThis.DOMMatrix === 'undefined') {
    console.log('🔧 [GLOBAL] Configurando polyfill DOMMatrix...');
    // eslint-disable-next-line func-style
    (globalThis as any).DOMMatrix = function DOMMatrix() {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
      return this;
    };
    // eslint-disable-next-line func-style
    (globalThis as any).DOMMatrix.prototype.inverse = function () {
      return new (globalThis as any).DOMMatrix();
    };
    // eslint-disable-next-line func-style
    (globalThis as any).DOMMatrix.prototype.multiply = function () {
      return new (globalThis as any).DOMMatrix();
    };
    // eslint-disable-next-line func-style
    (globalThis as any).DOMMatrix.prototype.translate = function () {
      return new (globalThis as any).DOMMatrix();
    };
    // eslint-disable-next-line func-style
    (globalThis as any).DOMMatrix.prototype.scale = function () {
      return new (globalThis as any).DOMMatrix();
    };
    // eslint-disable-next-line func-style
    (globalThis as any).DOMMatrix.prototype.rotate = function () {
      return new (globalThis as any).DOMMatrix();
    };
    (globalThis as any).DOMMatrix.fromMatrix = () =>
      new (globalThis as any).DOMMatrix();
    (globalThis as any).DOMMatrix.fromFloat32Array = () =>
      new (globalThis as any).DOMMatrix();
    (globalThis as any).DOMMatrix.fromFloat64Array = () =>
      new (globalThis as any).DOMMatrix();
  }

  // Polyfill para Path2D
  if (typeof globalThis.Path2D === 'undefined') {
    console.log('🔧 [GLOBAL] Configurando polyfill Path2D...');
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D = function Path2D() {
      return this;
    };
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.addPath = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.closePath = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.moveTo = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.lineTo = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.bezierCurveTo = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.quadraticCurveTo = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.arc = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.arcTo = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.ellipse = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.rect = function () {};
    // eslint-disable-next-line func-style
    (globalThis as any).Path2D.prototype.roundRect = function () {};
  }

  // Polyfill para OffscreenCanvas
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    console.log('🔧 [GLOBAL] Configurando polyfill OffscreenCanvas...');
    // eslint-disable-next-line func-style
    (globalThis as any).OffscreenCanvas = function OffscreenCanvas(
      width: number,
      height: number,
    ) {
      this.width = width;
      this.height = height;
      return this;
    };
    // eslint-disable-next-line func-style
    (globalThis as any).OffscreenCanvas.prototype.getContext = function () {
      return {
        canvas: { width: this.width, height: this.height },
        fillRect: () => {},
        clearRect: () => {},
        getImageData: () => ({
          data: new Uint8ClampedArray(this.width * this.height * 4),
        }),
        putImageData: () => {},
        createImageData: () => ({
          data: new Uint8ClampedArray(this.width * this.height * 4),
        }),
        setTransform: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        scale: () => {},
        rotate: () => {},
        translate: () => {},
        transform: () => {},
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
      };
    };
    // eslint-disable-next-line func-style
    (globalThis as any).OffscreenCanvas.prototype.transferToImageBitmap =
      function () {
        return { width: this.width, height: this.height };
      };
  }

  // Polyfill para ImageData
  if (typeof globalThis.ImageData === 'undefined') {
    console.log('🔧 [GLOBAL] Configurando polyfill ImageData...');
    // eslint-disable-next-line func-style
    (globalThis as any).ImageData = function ImageData(
      data: any,
      width: number,
      height?: number,
    ) {
      if (typeof data === 'number') {
        // ImageData(width, height)
        this.width = data;
        this.height = width;
        this.data = new Uint8ClampedArray(data * width * 4);
      } else {
        // ImageData(data, width, height?)
        this.data = data;
        this.width = width;
        this.height = height || data.length / (width * 4);
      }
      return this;
    };
  }

  console.log('✅ [GLOBAL] Todos os polyfills configurados globalmente');
}

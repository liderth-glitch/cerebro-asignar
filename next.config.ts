import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mover el indicador de desarrollo de Next.js a la esquina inferior-derecha
  // para que no tape el badge de version del sidebar
  devIndicators: {
    position: 'bottom-right',
  },
  experimental: {
    // Los adjuntos de procesos y los certificados suben por server action y el
    // límite del formulario es 20 MB. El default de Next es 1 MB, que rechazaría
    // cualquier procedimiento escaneado. Se deja holgura para el encoding.
    serverActions: { bodySizeLimit: '25mb' },
  },
};

export default nextConfig;

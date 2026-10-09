// Technology-specific names of the engine layers (010 FR-006, research D3). The data is never changed.
import type { TechnologyProfile } from './technology';

const VB: Record<string, string> = {
  Web: 'Presentación (formularios y reportes)',
  Compartida: 'Módulos compartidos',
  Datos: 'Acceso a datos (ADO.NET)',
  Controlador: 'Servicios web (ASMX/WCF)',
};

const CSHARP: Record<string, string> = {
  Web: 'Presentación web',
  Datos: 'Acceso a datos',
};

export function layerLabel(layer: string, profile: TechnologyProfile): string {
  if (profile.languages.includes('vb') && VB[layer]) return VB[layer];
  if (profile.technology !== 'java' && CSHARP[layer]) return CSHARP[layer];
  return layer;
}

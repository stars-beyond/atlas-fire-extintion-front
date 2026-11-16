// Câmera da cena 3D do habitat, no referencial do simulador de chama (centímetros a partir do centro do duto).
// A cena publica a câmera a cada quadro; o simulador, embutido como camada por cima da cena, desenha a chama
// com ela. É assim que a chama simulada aparece dentro da câmara de teste do habitat.
export interface LabCam { eye: number[]; target: number[]; up: number[]; fov: number }
export const labCam: { send: ((c: LabCam) => void) | null; last: LabCam | null } = { send: null, last: null }

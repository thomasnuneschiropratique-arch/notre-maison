// Niveau de qualité selon l'appareil : les écrans tactiles et les machines à peu de mémoire reçoivent des ressources légères.
const coarse = matchMedia('(pointer: coarse)').matches;
export const isPhone = () => coarse && Math.min(innerWidth, innerHeight) < 820;
export const LOW = coarse || (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 4);

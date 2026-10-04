/** Catalogue minimal de logiciels (le registre de gestion — éditeurs, licences — arrive avec les modules ITAM). */
export interface SoftwareDef { id: string; name: string; vendor: string; version: string }
const L: SoftwareDef[] = [
  { id: 'sw-office', name: 'Microsoft Office', vendor: 'Microsoft', version: '2021' },
  { id: 'sw-chrome', name: 'Google Chrome', vendor: 'Google', version: '129' },
  { id: 'sw-firefox', name: 'Mozilla Firefox', vendor: 'Mozilla', version: '131' },
  { id: 'sw-7zip', name: '7-Zip', vendor: 'Igor Pavlov', version: '24.08' },
  { id: 'sw-vlc', name: 'VLC media player', vendor: 'VideoLAN', version: '3.0' },
  { id: 'sw-acrobat', name: 'Adobe Acrobat Reader', vendor: 'Adobe', version: '24' },
  { id: 'sw-vscode', name: 'Visual Studio Code', vendor: 'Microsoft', version: '1.94' },
  { id: 'sw-teamviewer', name: 'TeamViewer', vendor: 'TeamViewer', version: '15' },
];
export const SOFTWARE: Record<string, SoftwareDef> = Object.fromEntries(L.map(x => [x.id, x]));
